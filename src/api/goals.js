import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validateRequiredFields, validateMaxLength, validateEnum, validateNonBlank } from '../shared/validation.js';
import { toCents, fromCents } from '../shared/money.js';
import * as Goals from '../db/goals.js';
import { calculateGoalPlan } from '../engine/goalsCalc.js';

export async function handleGoals(request, env, segments) {
  const id = segments[0];
  const sub = segments[1]; // 'contributions', quando presente
  const db = env.DB;
  const userId = request.user.id;

  if (!id) {
    if (request.method === 'GET') return listGoalsRoute(db, userId);
    if (request.method === 'POST') return createGoalRoute(request, db, userId);
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'contributions') {
    if (request.method === 'GET') {
      const contributions = await Goals.listContributions(db, id);
      return jsonOk({ contributions: contributions.map(c => ({ ...c, amount: fromCents(c.amount_cents) })) });
    }
    if (request.method === 'POST') return addContributionRoute(request, db, userId, id);
    return jsonError('Método não suportado.', 405);
  }

  if (request.method === 'PATCH') return updateGoalRoute(request, db, userId, id);

  return jsonError('Rota de metas não encontrada.', 404);
}

async function listGoalsRoute(db, userId) {
  const goals = await Goals.listGoals(db, userId);
  const serialized = goals.map(g => ({
    ...serializeGoal(g),
    plan: serializePlan(calculateGoalPlan(g))
  }));
  return jsonOk({ goals: serialized });
}

async function createGoalRoute(request, db, userId) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const errors = validateRequiredFields(body, ['name']);
  if (errors) return jsonError('Preencha os campos obrigatórios.');

  const blankError = validateNonBlank(body.name, 'Nome da meta');
  if (blankError) return jsonError(blankError);

  const nameError = validateMaxLength(body.name, 120, 'Nome da meta');
  if (nameError) return jsonError(nameError);

  const targetAmountCents = body.targetAmount !== undefined ? toCents(body.targetAmount) : null;
  if (body.targetAmount !== undefined && targetAmountCents === null) return jsonError('Valor alvo inválido.');
  if (targetAmountCents !== null && targetAmountCents <= 0) return jsonError('O valor-alvo da meta precisa ser maior que zero.');

  const goal = await Goals.createGoal(db, userId, {
    name: sanitizeText(body.name, { maxLength: 120 }),
    category: body.category ? sanitizeText(body.category, { maxLength: 80 }) : null,
    targetAmountCents,
    currentAmountCents: body.currentAmount !== undefined ? toCents(body.currentAmount) : 0,
    deadline: body.deadline || null,
    priority: body.priority || 3,
    monthlyContributionCents: body.monthlyContribution !== undefined ? toCents(body.monthlyContribution) : null,
    metric: body.metric ? sanitizeText(body.metric, { maxLength: 80 }) : null,
    progressCurrent: body.progressCurrent ?? null,
    progressTarget: body.progressTarget ?? null
  });

  return jsonOk({ goal: { ...serializeGoal(goal), plan: serializePlan(calculateGoalPlan(goal)) } }, 201);
}

async function updateGoalRoute(request, db, userId, id) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const fields = {};
  if (body.name !== undefined) fields.name = sanitizeText(body.name, { maxLength: 120 });
  if (body.category !== undefined) fields.category = sanitizeText(body.category, { maxLength: 80 });
  if (body.targetAmount !== undefined) {
    const targetAmountCents = toCents(body.targetAmount);
    if (targetAmountCents === null) return jsonError('Valor alvo inválido.');
    if (targetAmountCents <= 0) return jsonError('O valor-alvo da meta precisa ser maior que zero.');
    fields.targetAmountCents = targetAmountCents;
  }
  if (body.deadline !== undefined) fields.deadline = body.deadline;
  if (body.priority !== undefined) fields.priority = body.priority;
  if (body.monthlyContribution !== undefined) fields.monthlyContributionCents = toCents(body.monthlyContribution);
  if (body.progressCurrent !== undefined) fields.progressCurrent = body.progressCurrent;
  if (body.progressTarget !== undefined) fields.progressTarget = body.progressTarget;
  if (body.status !== undefined) {
    const statusError = validateEnum(body.status, ['ativa', 'concluida', 'pausada'], 'Status da meta');
    if (statusError) return jsonError(statusError);
    fields.status = body.status;
  }

  const goal = await Goals.updateGoal(db, userId, id, fields);
  if (!goal) return jsonError('Meta não encontrada.', 404);

  return jsonOk({ goal: { ...serializeGoal(goal), plan: serializePlan(calculateGoalPlan(goal)) } });
}

async function addContributionRoute(request, db, userId, goalId) {
  const body = await readJson(request);
  if (!body || body.amount === undefined || !body.date) {
    return jsonError('Informe valor e data da contribuição.');
  }

  const amountCents = toCents(body.amount);
  if (!amountCents || amountCents <= 0) return jsonError('Valor inválido.');

  const goal = await Goals.addContribution(db, userId, goalId, { amountCents, date: body.date });
  if (!goal) return jsonError('Meta não encontrada.', 404);

  return jsonOk({ goal: { ...serializeGoal(goal), plan: serializePlan(calculateGoalPlan(goal)) } }, 201);
}

function serializeGoal(g) {
  return {
    id: g.id,
    name: g.name,
    category: g.category,
    targetAmount: g.target_amount_cents !== null ? fromCents(g.target_amount_cents) : null,
    currentAmount: fromCents(g.current_amount_cents),
    deadline: g.deadline,
    priority: g.priority,
    monthlyContribution: g.monthly_contribution_cents !== null ? fromCents(g.monthly_contribution_cents) : null,
    status: g.status,
    metric: g.metric,
    progressCurrent: g.progress_current,
    progressTarget: g.progress_target
  };
}

function serializePlan(plan) {
  if (!plan.applicable) return { applicable: false };
  return {
    applicable: true,
    remaining: fromCents(plan.remaining_cents),
    monthsLeft: plan.months_left,
    requiredMonthly: fromCents(plan.required_monthly_cents),
    requiredWeekly: fromCents(plan.required_weekly_cents),
    requiredDaily: fromCents(plan.required_daily_cents),
    forecastMonths: plan.forecast_months,
    isBehindSchedule: plan.is_behind_schedule,
    requiredIncrease: fromCents(plan.required_increase_cents)
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
