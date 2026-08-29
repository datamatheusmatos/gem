import { jsonError, jsonOk } from '../shared/http.js';
import { fromCents, toCents } from '../shared/money.js';
import { FinancialEngine } from '../engine/FinancialEngine.js';
import { validateMonthFormat } from '../shared/validation.js';

export async function handleEngine(request, env, segments) {
  const action = segments[0];
  const db = env.DB;
  const userId = request.user.id;
  const engine = new FinancialEngine(db);
  const url = new URL(request.url);

  if (action === 'spending-limit' && request.method === 'GET') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const monthError = validateMonthFormat(month);
    if (monthError) return jsonError(monthError);
    const result = await engine.calculateSpendingLimit(userId, month);
    return jsonOk(serializeBreakdownResult(result));
  }

  if (action === 'limit-tiers' && request.method === 'GET') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const monthError = validateMonthFormat(month);
    if (monthError) return jsonError(monthError);
    const result = await engine.calculateLimitTiers(userId, month);
    return jsonOk({
      safe: fromCents(result.safe_cents),
      comfortable: fromCents(result.comfortable_cents),
      max: fromCents(result.max_cents),
      breakdown: serializeBreakdown(result.breakdown)
    });
  }

  if (action === 'simulate-purchase' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body || body.amount === undefined) return jsonError('Informe o valor da compra.');

    const amountCents = toCents(body.amount);
    if (!amountCents || amountCents <= 0) return jsonError('Valor inválido.');
    if (body.installments && (body.installments < 1 || body.installments > 60)) {
      return jsonError('Quantidade de parcelas inválida.');
    }

    const result = await engine.simulatePurchase(userId, {
      amountCents,
      categoryId: body.categoryId || null,
      installments: body.installments || 1
    });

    return jsonOk({
      verdict: result.verdict,
      impact: {
        monthlyImpact: fromCents(result.impact.monthly_impact_cents),
        monthsAffected: result.impact.months_affected,
        remainingAfter: fromCents(result.impact.remaining_after_cents),
        tiers: {
          safe: fromCents(result.impact.tiers.safe_cents),
          comfortable: fromCents(result.impact.tiers.comfortable_cents),
          max: fromCents(result.impact.tiers.max_cents)
        }
      }
    });
  }

  if (action === 'cash-flow-projection' && request.method === 'GET') {
    const months = parseInt(url.searchParams.get('months') || '6', 10);
    if (!Number.isInteger(months) || months < 1 || months > 60) return jsonError('Período de projeção inválido.');

    const result = await engine.projectCashFlow(userId, months);
    return jsonOk({
      safetyMargin: fromCents(result.safety_margin_cents),
      projection: result.projection.map(p => ({
        month: p.month,
        netFlow: fromCents(p.net_flow_cents),
        projectedNetWorth: fromCents(p.projected_net_worth_cents),
        isEstimate: p.is_estimate
      }))
    });
  }

  if (action === 'net-worth' && request.method === 'GET') {
    const netWorth = await engine.calculateNetWorth(userId);
    return jsonOk({ netWorth: fromCents(netWorth) });
  }

  if (action === 'savings-rate' && request.method === 'GET') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const monthError = validateMonthFormat(month);
    if (monthError) return jsonError(monthError);
    const rate = await engine.calculateSavingsRate(userId, month);
    return jsonOk({ savingsRatePercent: rate });
  }

  if (action === 'simulate-debt-payoff' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body || !body.debtId) return jsonError('Informe a dívida a simular.');

    const result = await engine.simulateDebtPayoff(body.debtId, {
      extraPaymentCents: body.extraPayment ? toCents(body.extraPayment) : 0,
      extraInstallments: body.extraInstallments || 0
    });
    if (!result) return jsonError('Dívida não encontrada.', 404);

    return jsonOk({
      isEstimate: result.is_estimate,
      monthsSaved: result.months_saved,
      newMonthsRemaining: result.new_months_remaining,
      estimatedInterestSaved: fromCents(result.estimated_interest_saved_cents)
    });
  }

  return jsonError('Rota do motor financeiro não encontrada.', 404);
}

function serializeBreakdownResult(result) {
  return {
    available: fromCents(result.available_cents),
    daily: fromCents(result.daily_cents),
    weekly: fromCents(result.weekly_cents),
    daysRemaining: result.days_remaining,
    breakdown: serializeBreakdown(result.breakdown)
  };
}

function serializeBreakdown(breakdown) {
  return breakdown.map(b => ({ label: b.label, amount: fromCents(b.amount_cents), sign: b.sign }));
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
