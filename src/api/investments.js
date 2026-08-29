import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validateRequiredFields, validateEnum, validateMaxLength } from '../shared/validation.js';
import { toCents, fromCents } from '../shared/money.js';
import * as Investments from '../db/investments.js';

const CATEGORIES = ['renda_fixa', 'fundos', 'acoes', 'etf', 'cripto', 'outros'];

export async function handleInvestments(request, env, segments) {
  const id = segments[0];
  const sub = segments[1]; // 'movements'
  const db = env.DB;
  const userId = request.user.id;

  if (!id) {
    if (request.method === 'GET') return listRoute(db, userId);
    if (request.method === 'POST') return createRoute(request, db, userId);
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'movements') {
    if (request.method === 'GET') {
      const movements = await Investments.listMovements(db, id);
      return jsonOk({ movements: movements.map(serializeMovement) });
    }
    if (request.method === 'POST') return movementRoute(request, db, userId, id);
    return jsonError('Método não suportado.', 405);
  }

  if (!sub && request.method === 'PATCH') return updateRoute(request, db, userId, id);
  if (!sub && request.method === 'DELETE') {
    const ok = await Investments.archiveInvestment(db, userId, id);
    if (!ok) return jsonError('Investimento não encontrado.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Rota de investimentos não encontrada.', 404);
}

async function listRoute(db, userId) {
  const investments = await Investments.listInvestments(db, userId);
  return jsonOk({ investments: investments.map(serializeInvestment) });
}

async function createRoute(request, db, userId) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const errors = validateRequiredFields(body, ['name', 'category']);
  if (errors) return jsonError('Preencha os campos obrigatórios.');

  const nameError = validateMaxLength(body.name, 150, 'Nome do investimento');
  if (nameError) return jsonError(nameError);

  const categoryError = validateEnum(body.category, CATEGORIES, 'Categoria do investimento');
  if (categoryError) return jsonError(categoryError);

  const avgPriceCents = body.avgPrice !== undefined ? toCents(body.avgPrice) : 0;
  const currentValueCents = body.currentValue !== undefined ? toCents(body.currentValue) : 0;
  if (currentValueCents === null || currentValueCents < 0) return jsonError('Valor atual inválido.');
  if (body.quantity !== undefined && body.quantity < 0) return jsonError('Quantidade não pode ser negativa.');
  if (avgPriceCents !== null && avgPriceCents < 0) return jsonError('Preço médio inválido.');

  const investment = await Investments.createInvestment(db, userId, {
    name: sanitizeText(body.name, { maxLength: 150 }),
    category: body.category,
    institution: body.institution ? sanitizeText(body.institution, { maxLength: 150 }) : null,
    quantity: body.quantity || 0,
    avgPriceCents: avgPriceCents || 0,
    currentValueCents: currentValueCents || 0
  });

  return jsonOk({ investment: serializeInvestment(investment) }, 201);
}

async function updateRoute(request, db, userId, id) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const fields = {};
  if (body.name !== undefined) {
    const nameError = validateMaxLength(body.name, 150, 'Nome do investimento');
    if (nameError) return jsonError(nameError);
    fields.name = sanitizeText(body.name, { maxLength: 150 });
  }
  if (body.institution !== undefined) fields.institution = sanitizeText(body.institution, { maxLength: 150 });
  if (body.quantity !== undefined) fields.quantity = body.quantity;
  if (body.avgPrice !== undefined) fields.avgPriceCents = toCents(body.avgPrice);
  if (body.currentValue !== undefined) {
    const currentValueCents = toCents(body.currentValue);
    if (currentValueCents === null || currentValueCents < 0) return jsonError('Valor atual inválido.');
    fields.currentValueCents = currentValueCents;
  }

  const investment = await Investments.updateInvestment(db, userId, id, fields);
  if (!investment) return jsonError('Investimento não encontrado.', 404);
  return jsonOk({ investment: serializeInvestment(investment) });
}

async function movementRoute(request, db, userId, investmentId) {
  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const errors = validateRequiredFields(body, ['type', 'amount', 'date']);
  if (errors) return jsonError('Preencha os campos obrigatórios.');

  const typeError = validateEnum(body.type, ['aporte', 'resgate'], 'Tipo de movimento');
  if (typeError) return jsonError(typeError);

  const amountCents = toCents(body.amount);
  if (!amountCents || amountCents <= 0) return jsonError('Valor do movimento inválido.');

  if (body.type === 'resgate') {
    const current = await db.prepare('SELECT current_value_cents FROM investments WHERE id = ? AND user_id = ? AND archived = 0')
      .bind(investmentId, userId).first();
    if (!current) return jsonError('Investimento não encontrado.', 404);
    if (amountCents > current.current_value_cents) {
      return jsonError(`Resgate maior que o saldo disponível (${fromCents(current.current_value_cents).toFixed(2)}).`);
    }
  }

  const investment = await Investments.recordMovement(db, userId, investmentId, {
    type: body.type, amountCents, quantity: body.quantity || null, date: body.date
  });
  if (!investment) return jsonError('Investimento não encontrado.', 404);

  return jsonOk({ investment: serializeInvestment(investment) }, 201);
}

function serializeInvestment(i) {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    institution: i.institution,
    quantity: i.quantity,
    avgPrice: fromCents(i.avg_price_cents),
    currentValue: fromCents(i.current_value_cents)
  };
}

function serializeMovement(m) {
  return { id: m.id, type: m.type, amount: fromCents(m.amount_cents), quantity: m.quantity, date: m.date };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
