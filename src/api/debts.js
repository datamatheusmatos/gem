import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validateRequiredFields, validateEnum, validateRange, validateMaxLength, validatePositive } from '../shared/validation.js';
import { toCents, fromCents } from '../shared/money.js';
import * as Debts from '../db/debts.js';
import { FinancialEngine } from '../engine/FinancialEngine.js';

export async function handleDebts(request, env, segments) {
  const id = segments[0];
  const sub = segments[1]; // 'payments' ou 'simulate-payoff'
  const db = env.DB;
  const userId = request.user.id;

  if (!id) {
    if (request.method === 'GET') return listRoute(db, userId);
    if (request.method === 'POST') return createRoute(request, db, userId);
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'payments') {
    if (request.method === 'GET') {
      const payments = await Debts.listDebtPayments(db, id);
      return jsonOk({ payments: payments.map(serializePayment) });
    }
    if (request.method === 'POST') return paymentRoute(request, db, userId, id);
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'simulate-payoff' && request.method === 'POST') {
    return simulatePayoffRoute(request, db, id);
  }

  if (!sub && request.method === 'PATCH') return updateRoute(request, db, userId, id);
  if (!sub && request.method === 'DELETE') {
    const ok = await Debts.archiveDebt(db, userId, id);
    if (!ok) return jsonError('Dívida não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Rota de dívidas não encontrada.', 404);
}

async function listRoute(db, userId) {
  const debts = await Debts.listActiveDebtsFull(db, userId);
  return jsonOk({ debts: debts.map(serializeDebt) });
}

async function createRoute(request, db, userId) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const errors = validateRequiredFields(body, ['name', 'originalAmount', 'installmentsTotal', 'installmentAmount', 'startDate', 'dueDay']);
  if (errors) return jsonError('Preencha os campos obrigatórios.');

  const nameError = validateMaxLength(body.name, 150, 'Nome do financiamento');
  if (nameError) return jsonError(nameError);

  const dueDayError = validateRange(body.dueDay, 1, 31, 'Dia de vencimento');
  if (dueDayError) return jsonError(dueDayError);

  const amortizationError = validateEnum(body.amortizationSystem, ['price', 'sac'], 'Sistema de amortização');
  if (amortizationError) return jsonError(amortizationError);

  const installmentsTotalError = validatePositive(body.installmentsTotal, 'Quantidade total de parcelas');
  if (installmentsTotalError) return jsonError(installmentsTotalError);

  const originalAmountCents = toCents(body.originalAmount);
  if (!originalAmountCents || originalAmountCents <= 0) return jsonError('Valor original inválido.');

  const installmentAmountCents = toCents(body.installmentAmount);
  if (!installmentAmountCents || installmentAmountCents <= 0) return jsonError('Valor da parcela inválido.');

  const remainingAmountCents = body.remainingAmount !== undefined ? toCents(body.remainingAmount) : originalAmountCents;
  if (remainingAmountCents === null || remainingAmountCents < 0) return jsonError('Saldo devedor inválido.');

  const debt = await Debts.createDebt(db, userId, {
    name: sanitizeText(body.name, { maxLength: 150 }),
    institution: body.institution ? sanitizeText(body.institution, { maxLength: 150 }) : null,
    originalAmountCents,
    remainingAmountCents,
    rateMonthly: body.rateMonthly || 0,
    amortizationSystem: body.amortizationSystem || null,
    installmentsTotal: body.installmentsTotal,
    installmentsPaid: body.installmentsPaid || 0,
    installmentAmountCents,
    startDate: body.startDate,
    dueDay: body.dueDay
  });

  return jsonOk({ debt: serializeDebt(debt) }, 201);
}

async function updateRoute(request, db, userId, id) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const fields = {};
  if (body.name !== undefined) {
    const nameError = validateMaxLength(body.name, 150, 'Nome do financiamento');
    if (nameError) return jsonError(nameError);
    fields.name = sanitizeText(body.name, { maxLength: 150 });
  }
  if (body.institution !== undefined) fields.institution = sanitizeText(body.institution, { maxLength: 150 });
  if (body.remainingAmount !== undefined) {
    const remainingAmountCents = toCents(body.remainingAmount);
    if (remainingAmountCents === null || remainingAmountCents < 0) return jsonError('Saldo devedor inválido.');
    fields.remainingAmountCents = remainingAmountCents;
  }
  if (body.rateMonthly !== undefined) fields.rateMonthly = body.rateMonthly;
  if (body.installmentAmount !== undefined) {
    const installmentAmountCents = toCents(body.installmentAmount);
    if (!installmentAmountCents || installmentAmountCents <= 0) return jsonError('Valor da parcela inválido.');
    fields.installmentAmountCents = installmentAmountCents;
  }
  if (body.dueDay !== undefined) {
    const dueDayError = validateRange(body.dueDay, 1, 31, 'Dia de vencimento');
    if (dueDayError) return jsonError(dueDayError);
    fields.dueDay = body.dueDay;
  }

  const debt = await Debts.updateDebt(db, userId, id, fields);
  if (!debt) return jsonError('Dívida não encontrada.', 404);
  return jsonOk({ debt: serializeDebt(debt) });
}

async function paymentRoute(request, db, userId, debtId) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const errors = validateRequiredFields(body, ['amount', 'principal', 'paidDate']);
  if (errors) return jsonError('Preencha os campos obrigatórios.');

  const amountCents = toCents(body.amount);
  if (!amountCents || amountCents <= 0) return jsonError('Valor do pagamento inválido.');

  const principalCents = toCents(body.principal);
  if (principalCents === null || principalCents < 0) return jsonError('Valor de amortização (principal) inválido.');

  const interestCents = body.interest !== undefined ? toCents(body.interest) : 0;
  if (interestCents === null || interestCents < 0) return jsonError('Valor de juros inválido.');

  const debt = await Debts.recordDebtPayment(db, userId, debtId, {
    amountCents, principalCents, interestCents, paidDate: body.paidDate, isExtra: !!body.isExtra
  });
  if (!debt) return jsonError('Dívida não encontrada.', 404);

  return jsonOk({ debt: serializeDebt(debt) }, 201);
}

async function simulatePayoffRoute(request, db, debtId) {
  const body = await readJson(request);
  const engine = new FinancialEngine(db);

  const extraPaymentCents = body?.extraPayment ? toCents(body.extraPayment) : 0;
  if (body?.extraPayment !== undefined && (extraPaymentCents === null || extraPaymentCents < 0)) {
    return jsonError('Valor extra de pagamento inválido.');
  }

  const result = await engine.simulateDebtPayoff(debtId, {
    extraPaymentCents: extraPaymentCents || 0,
    extraInstallments: body?.extraInstallments || 0
  });
  if (!result) return jsonError('Dívida não encontrada.', 404);

  return jsonOk({
    isEstimate: result.is_estimate,
    monthsSaved: result.months_saved,
    newMonthsRemaining: result.new_months_remaining,
    estimatedInterestSaved: fromCents(result.estimated_interest_saved_cents)
  });
}

function serializeDebt(d) {
  return {
    id: d.id,
    name: d.name,
    institution: d.institution,
    originalAmount: fromCents(d.original_amount_cents),
    remainingAmount: fromCents(d.remaining_amount_cents),
    rateMonthly: d.rate_monthly,
    amortizationSystem: d.amortization_system,
    installmentsTotal: d.installments_total,
    installmentsPaid: d.installments_paid,
    installmentAmount: fromCents(d.installment_amount_cents),
    startDate: d.start_date,
    dueDay: d.due_day
  };
}

function serializePayment(p) {
  return {
    id: p.id,
    amount: fromCents(p.amount_cents),
    principal: fromCents(p.principal_cents),
    interest: fromCents(p.interest_cents),
    paidDate: p.paid_date,
    isExtra: !!p.is_extra
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
