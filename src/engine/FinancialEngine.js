// FinancialEngine: única fonte de verdade para cálculos financeiros (seção 43).
// Toda saída inclui um `breakdown` — a lista ordenada de componentes que a tela
// "como esse valor foi calculado?" (seção 45) usa para explicar o número, sem
// esconder nenhuma fórmula dentro da UI.

import {
  sumIncomeInRange, sumExpensesInRange, listActiveDebts, listActiveGoals,
  sumInvestmentContributionsInRange, getSafetyMarginCents,
  sumAccountBalances, sumInvestmentValue, sumDebtRemaining,
  listMonthlyRecurringTransactions
} from '../db/financeSummary.js';
import { addMonths } from '../shared/dates.js';

function monthRange(period) {
  const [year, month] = period.split('-').map(Number);
  const start = `${period}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function daysRemainingInMonth(period, today = new Date()) {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isCurrentMonth = today.getUTCFullYear() === year && (today.getUTCMonth() + 1) === month;
  const currentDay = isCurrentMonth ? today.getUTCDate() : 1;
  return Math.max(lastDay - currentDay + 1, 1);
}

// Débitos cuja parcela cai neste período (o vencimento é definido por due_day,
// não por uma linha em `transactions` — dívidas são um domínio próprio).
function debtsDueInPeriod(debts, period) {
  return debts.filter(d => {
    // considera "devida no período" toda dívida ativa (installments_paid < total);
    // simplificação deliberada: uma dívida ativa gera uma parcela por mês corrente.
    return true;
  }).map(d => ({ id: d.id, name: d.name, amount_cents: d.installment_amount_cents }));
}

export class FinancialEngine {
  constructor(db) {
    this.db = db;
  }

  async calculateSpendingLimit(userId, referenceMonth) {
    const range = monthRange(referenceMonth);
    const db = this.db;

    const income = await sumIncomeInRange(db, userId, range);
    const expenses = await sumExpensesInRange(db, userId, range);
    const debts = await listActiveDebts(db, userId);
    const goals = await listActiveGoals(db, userId);
    const safetyMargin = await getSafetyMarginCents(db, userId);

    const debtInstallments = debtsDueInPeriod(debts, referenceMonth);
    const debtTotal = debtInstallments.reduce((sum, d) => sum + d.amount_cents, 0);
    const goalTotal = goals.reduce((sum, g) => sum + (g.monthly_contribution_cents || 0), 0);

    const breakdown = [
      { label: 'Renda prevista', amount_cents: income, sign: 1 },
      { label: 'Despesas do mês (fixas e variáveis)', amount_cents: expenses, sign: -1 },
      ...debtInstallments.map(d => ({ label: `Financiamento: ${d.name}`, amount_cents: d.amount_cents, sign: -1 })),
      ...(goalTotal > 0 ? [{ label: 'Contribuições para metas', amount_cents: goalTotal, sign: -1 }] : []),
      { label: 'Margem de segurança', amount_cents: safetyMargin, sign: -1 }
    ];

    const availableCents = income - expenses - debtTotal - goalTotal - safetyMargin;
    const daysRemaining = daysRemainingInMonth(referenceMonth);

    return {
      available_cents: availableCents,
      daily_cents: Math.floor(Math.max(availableCents, 0) / daysRemaining),
      weekly_cents: Math.floor(Math.max(availableCents, 0) / Math.ceil(daysRemaining / 7)),
      days_remaining: daysRemaining,
      breakdown
    };
  }

  async calculateLimitTiers(userId, referenceMonth) {
    const { available_cents, breakdown } = await this.calculateSpendingLimit(userId, referenceMonth);
    const safetyMargin = await getSafetyMarginCents(this.db, userId);

    // Confortável = o disponível já calculado (a margem de segurança já foi
    // reservada). Seguro = mais conservador ainda, reduz 30% de folga extra.
    // Máximo = comprometeria a própria margem de segurança — nunca recomendado
    // como número principal (seção 10).
    const comfortable = Math.max(available_cents, 0);
    const safe = Math.floor(comfortable * 0.7);
    const max = comfortable + safetyMargin;

    return { safe_cents: safe, comfortable_cents: comfortable, max_cents: max, breakdown };
  }

  // Avalia uma compra simulada sem persistir nada (seção 11: "Posso comprar?").
  async simulatePurchase(userId, { amountCents, categoryId, installments = 1 }) {
    const referenceMonth = new Date().toISOString().slice(0, 7);
    const tiers = await this.calculateLimitTiers(userId, referenceMonth);

    const monthlyImpact = installments > 1 ? Math.ceil(amountCents / installments) : amountCents;
    const remainingAfter = tiers.comfortable_cents - monthlyImpact;

    let verdict;
    if (remainingAfter >= tiers.safe_cents) verdict = 'segura';
    else if (remainingAfter >= 0) verdict = 'atencao';
    else verdict = 'nao_recomendada';

    return {
      verdict,
      impact: {
        monthly_impact_cents: monthlyImpact,
        months_affected: installments > 1 ? installments : 1,
        remaining_after_cents: remainingAfter,
        tiers
      }
    };
  }

  // Projeção simples de fluxo de caixa/patrimônio para N meses à frente, com
  // base nas recorrências mensais já cadastradas. É uma estimativa, não uma
  // garantia (seção 53) — quanto mais distante o mês, menos precisa a projeção.
  async projectCashFlow(userId, months) {
    const db = this.db;
    const recurring = await listMonthlyRecurringTransactions(db, userId);
    const debts = await listActiveDebts(db, userId);
    const goals = await listActiveGoals(db, userId);
    const safetyMargin = await getSafetyMarginCents(db, userId);

    const monthlyIncome = recurring.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount_cents, 0);
    const monthlyExpense = recurring.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount_cents, 0);
    const goalTotal = goals.reduce((s, g) => s + (g.monthly_contribution_cents || 0), 0);

    let netWorth = await this.calculateNetWorth(userId);
    const projection = [];
    let remainingDebts = debts.map(d => ({ ...d }));

    for (let i = 1; i <= months; i++) {
      const monthLabel = addMonths(new Date().toISOString().slice(0, 10), i).slice(0, 7);

      const debtTotal = remainingDebts.reduce((s, d) => s + d.installment_amount_cents, 0);
      const netFlow = monthlyIncome - monthlyExpense - debtTotal - goalTotal;
      netWorth += netFlow;

      // avança quitação simplificada de dívidas (uma parcela por mês)
      remainingDebts = remainingDebts
        .map(d => ({ ...d, installments_paid: d.installments_paid + 1 }))
        .filter(d => d.installments_paid < d.installments_total);

      projection.push({
        month: monthLabel,
        net_flow_cents: netFlow,
        projected_net_worth_cents: netWorth,
        is_estimate: true
      });
    }

    return { safety_margin_cents: safetyMargin, projection };
  }

  async calculateNetWorth(userId) {
    const db = this.db;
    const accounts = await sumAccountBalances(db, userId);
    const investments = await sumInvestmentValue(db, userId);
    const debts = await sumDebtRemaining(db, userId);
    return accounts + investments - debts;
  }

  async calculateSavingsRate(userId, referenceMonth) {
    const range = monthRange(referenceMonth);
    const income = await sumIncomeInRange(this.db, userId, range);
    if (income <= 0) return 0;

    const goals = await listActiveGoals(this.db, userId);
    const goalTotal = goals.reduce((s, g) => s + (g.monthly_contribution_cents || 0), 0);
    const investmentContrib = await sumInvestmentContributionsInRange(this.db, userId, range);

    return Math.round(((goalTotal + investmentContrib) / income) * 100);
  }

  // Simulação de amortização — estimativa simplificada (não substitui a tabela
  // de amortização real Price/SAC, que fica marcada como melhoria futura).
  async simulateDebtPayoff(debtId, { extraPaymentCents = 0, extraInstallments = 0 }) {
    const debt = await this.db.prepare('SELECT * FROM debts WHERE id = ?').bind(debtId).first();
    if (!debt) return null;

    const currentMonthsRemaining = debt.installments_total - debt.installments_paid;
    const extraFromInstallments = extraInstallments * debt.installment_amount_cents;
    const totalExtra = extraPaymentCents + extraFromInstallments;

    const newRemaining = Math.max(debt.remaining_amount_cents - totalExtra, 0);
    const newMonthsRemaining = debt.installment_amount_cents > 0
      ? Math.ceil(newRemaining / debt.installment_amount_cents)
      : 0;

    const monthsSaved = Math.max(currentMonthsRemaining - newMonthsRemaining, 0);
    const estimatedInterestSaved = Math.round(monthsSaved * debt.installment_amount_cents * (debt.rate_monthly || 0));

    return {
      is_estimate: true,
      months_saved: monthsSaved,
      new_months_remaining: newMonthsRemaining,
      estimated_interest_saved_cents: estimatedInterestSaved
    };
  }
}
