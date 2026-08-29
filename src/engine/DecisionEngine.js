// DecisionEngine: recebe dados já calculados pelo FinancialEngine e pelos
// demais módulos (metas, estudos, hábitos, foco, tempo) e produz recomendações,
// alertas e prioridades. Nunca recalcula números financeiros por conta própria
// — só interpreta o que já foi determinado em outro lugar (seção 44).
//
// Deliberadamente 100% baseado em regras determinísticas (thresholds,
// comparações, formatação de texto) — sem chamada a nenhuma API de IA paga,
// para manter o app 100% gratuito, conforme decidido com o usuário.

import { budgetStatusForPeriod } from '../db/budgets.js';
import { listActiveDebts, listActiveGoals } from '../db/financeSummary.js';
import { calculateGoalPlan } from './goalsCalc.js';
import { calculateStudyPace } from './studyCalc.js';
import { calculateComplianceRate } from './habitsCalc.js';
import { analyzeDurationVsProductivity, analyzeBestHours } from './focusCalc.js';
import { listStudyItems, listRecentStudySessions } from '../db/studyItems.js';
import { listHabits, listHabitLogsInRange } from '../db/habits.js';
import { listFocusSessionsInRange } from '../db/focusSessions.js';
import { saveInsights } from '../db/insights.js';
import { saveNotifications } from '../db/notifications.js';
import { fromCents } from '../shared/money.js';

function formatBRL(cents) {
  return `R$ ${fromCents(cents).toFixed(2).replace('.', ',')}`;
}

export class DecisionEngine {
  constructor(financialEngine, db) {
    this.financialEngine = financialEngine;
    this.db = db;
  }

  async generateInsights(userId) {
    const db = this.db;
    const today = new Date();
    const month = today.toISOString().slice(0, 7);
    const insights = [];

    // --- Financeiro: orçamento próximo do limite ---
    const budgets = await budgetStatusForPeriod(db, userId, month);
    for (const b of budgets) {
      if (b.percent_used >= 80) {
        insights.push({
          domain: 'financeiro',
          message: `Seu orçamento de ${b.category_name} está em ${b.percent_used}% — restam ${formatBRL(b.remaining_cents)} para o mês.`,
          data: { budgetId: b.budget_id, percentUsed: b.percent_used }
        });
      }
    }

    // --- Financeiro: parcela/dívida terminando em breve ---
    const debts = await listActiveDebts(db, userId);
    for (const d of debts) {
      if (d.installments_paid === d.installments_total - 1) {
        insights.push({
          domain: 'financeiro',
          message: `A parcela de ${d.name} termina no próximo mês. Sua margem mensal deve aumentar em aproximadamente ${formatBRL(d.installment_amount_cents)}.`,
          data: { debtId: d.id, installmentAmountCents: d.installment_amount_cents }
        });
      }
    }

    // --- Metas atrasadas ---
    const goals = await listActiveGoals(db, userId);
    for (const g of goals) {
      const plan = calculateGoalPlan(g);
      if (plan.applicable && plan.is_behind_schedule) {
        insights.push({
          domain: 'planejamento',
          message: `Para atingir a meta "${g.name}" no prazo, aumente sua contribuição mensal em ${formatBRL(plan.required_increase_cents)}.`,
          data: { goalId: g.id, requiredIncreaseCents: plan.required_increase_cents }
        });
      }
    }

    // --- Estudos abaixo do ritmo ---
    const studyItems = await listStudyItems(db, userId);
    for (const item of studyItems) {
      const recentSessions = await listRecentStudySessions(db, item.id, addDays(today, -28));
      const pace = calculateStudyPace(item, recentSessions);
      if (pace.applicable && pace.is_behind && pace.percent_behind >= 10) {
        insights.push({
          domain: 'estudos',
          message: `Você está ${pace.percent_behind}% abaixo do ritmo necessário para concluir "${item.name}" no prazo.`,
          data: { studyItemId: item.id, percentBehind: pace.percent_behind }
        });
      }
    }

    // --- Hábitos com baixa consistência ---
    const habits = await listHabits(db, userId);
    const rangeStart = addDays(today, -28);
    const rangeEnd = today.toISOString().slice(0, 10);
    for (const h of habits) {
      const logs = await listHabitLogsInRange(db, h.id, { start: rangeStart, end: rangeEnd });
      if (logs.length === 0) continue;
      const rate = calculateComplianceRate(logs, { periodDays: 28, frequency: h.frequency });
      if (rate < 50) {
        insights.push({
          domain: 'habitos',
          message: `Sua consistência no hábito "${h.name}" caiu para ${rate}% nas últimas 4 semanas.`,
          data: { habitId: h.id, complianceRate: rate }
        });
      }
    }

    // --- Padrões de foco ---
    const focusSessions = await listFocusSessionsInRange(db, userId, {
      start: addDays(today, -28) + 'T00:00:00Z', end: rangeEnd + 'T23:59:59Z'
    });
    const durationPattern = analyzeDurationVsProductivity(focusSessions);
    if (durationPattern.has_enough_data) {
      const best = [...durationPattern.buckets].sort((a, b) => b.avg_productivity - a.avg_productivity)[0];
      const worst = [...durationPattern.buckets].sort((a, b) => a.avg_productivity - b.avg_productivity)[0];
      if (best && worst && best.label !== worst.label && (best.avg_productivity - worst.avg_productivity) >= 1) {
        insights.push({
          domain: 'foco',
          message: `Seu melhor desempenho ocorre em sessões de ${best.label} (produtividade média ${best.avg_productivity}/5).`,
          data: durationPattern
        });
      }
    }

    await saveInsights(db, userId, insights);
    return insights;
  }

  async generateAlerts(userId) {
    const db = this.db;
    const month = new Date().toISOString().slice(0, 7);
    const alerts = [];

    const spending = await this.financialEngine.calculateSpendingLimit(userId, month);
    if (spending.available_cents < 0) {
      alerts.push({
        category: 'financeiro',
        level: 'critico',
        message: `Seu fluxo de caixa está negativo em ${formatBRL(-spending.available_cents)} este mês.`
      });
    }

    const budgets = await budgetStatusForPeriod(db, userId, month);
    for (const b of budgets) {
      if (b.percent_used >= 100) {
        alerts.push({ category: 'orcamento', level: 'critico', message: `Você ultrapassou o orçamento de ${b.category_name}.` });
      } else if (b.percent_used >= 90) {
        alerts.push({ category: 'orcamento', level: 'importante', message: `Orçamento de ${b.category_name} em ${b.percent_used}% — quase no limite.` });
      }
    }

    const goals = await listActiveGoals(db, userId);
    for (const g of goals) {
      const plan = calculateGoalPlan(g);
      if (plan.applicable && plan.is_behind_schedule) {
        alerts.push({ category: 'metas', level: 'importante', message: `A meta "${g.name}" está atrasada em relação ao prazo definido.` });
      }
    }

    await saveNotifications(db, userId, alerts);
    return alerts;
  }

  // Prioridade dinâmica combinada (seção 56): tarefas já têm score próprio
  // (calculateTaskPriorityScore, Fase 6) — aqui só juntamos metas no mesmo
  // ranking, usando a mesma lógica de "quanto mais perto o prazo, maior a
  // prioridade", para exibir um único painel de prioridades no assistente.
  async recalculatePriorities(userId) {
    const db = this.db;
    const goals = await listActiveGoals(db, userId);
    const today = new Date();

    const goalPriorities = goals.map(g => {
      let deadlineBoost = 0;
      if (g.deadline) {
        const daysLeft = Math.max(Math.round((new Date(g.deadline) - today) / 86400000), 0);
        deadlineBoost = Math.min(5, Math.max(0, 5 - Math.floor(daysLeft / 30)));
      }
      return { type: 'meta', id: g.id, title: g.name, score: (6 - g.priority) * 2 + deadlineBoost };
    });

    return goalPriorities.sort((a, b) => b.score - a.score);
  }

  // Conflitos financeiros/planejamento de alto nível (seção 55): aqui só o
  // conflito "meta exige mais do que o orçamento permite" — conflitos de
  // agenda/tempo já são resolvidos em src/engine/timeCalc.js (Fase 6).
  async detectConflicts(userId) {
    const month = new Date().toISOString().slice(0, 7);
    const spending = await this.financialEngine.calculateSpendingLimit(userId, month);
    const conflicts = [];

    if (spending.available_cents < 0) {
      conflicts.push({
        type: 'orcamento_insuficiente',
        message: 'Os compromissos e metas atuais excedem a renda prevista deste mês.',
        breakdown: spending.breakdown
      });
    }
    return conflicts;
  }
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
