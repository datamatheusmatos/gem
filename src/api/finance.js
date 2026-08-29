import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validateRequiredFields, validateMonthFormat, validateEnum, validateRange, validateMaxLength, validatePositive } from '../shared/validation.js';
import { toCents, fromCents } from '../shared/money.js';
import { currentMonthRange } from '../shared/dates.js';
import * as Accounts from '../db/accounts.js';
import * as Cards from '../db/cards.js';
import * as Categories from '../db/categories.js';
import * as Transactions from '../db/transactions.js';
import * as Budgets from '../db/budgets.js';

export async function handleFinance(request, env, segments) {
  const resource = segments[0]; // accounts | cards | categories | transactions | budgets | transfers
  const id = segments[1];
  const db = env.DB;
  const userId = request.user.id;

  if (resource === 'accounts') return accountsRoute(request, db, userId, id);
  if (resource === 'transfers') return transfersRoute(request, db, userId);
  if (resource === 'cards') return cardsRoute(request, db, userId, id);
  if (resource === 'categories') return categoriesRoute(request, db, userId, id);
  if (resource === 'transactions') return transactionsRoute(request, db, userId, id);
  if (resource === 'budgets') return budgetsRoute(request, db, userId);
  // Dívidas e investimentos vivem em domínios próprios: /api/debts e
  // /api/investments (src/api/debts.js, src/api/investments.js) — essa
  // versão é a que tem edição (PATCH) e simulação de amortização dedicada.
  // Removida a duplicação que existia aqui.

  return jsonError('Rota financeira não encontrada.', 404);
}

// ---------- Contas ----------

async function accountsRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const accounts = await Accounts.listAccounts(db, userId);
    return jsonOk({ accounts: accounts.map(serializeAccount) });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');

    const errors = validateRequiredFields(body, ['name', 'type']);
    if (errors) return jsonError('Preencha os campos obrigatórios.', 400);

    const typeError = validateEnum(body.type, ['corrente', 'poupanca', 'carteira', 'digital', 'investimento', 'outros'], 'Tipo de conta');
    if (typeError) return jsonError(typeError);

    const nameError = validateMaxLength(body.name, 120, 'Nome da conta');
    if (nameError) return jsonError(nameError);

    const balanceCents = body.balance !== undefined ? toCents(body.balance) : 0;
    if (balanceCents === null) return jsonError('Saldo inicial inválido.');

    const account = await Accounts.createAccount(db, userId, {
      name: sanitizeText(body.name, { maxLength: 120 }),
      type: body.type,
      balanceCents
    });
    return jsonOk({ account: serializeAccount(account) }, 201);
  }

  if (!id) return jsonError('Informe o id da conta.', 400);

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    const fields = {};
    if (body.name !== undefined) {
      const nameError = validateMaxLength(body.name, 120, 'Nome da conta');
      if (nameError) return jsonError(nameError);
      fields.name = sanitizeText(body.name, { maxLength: 120 });
    }
    if (body.type !== undefined) {
      const typeError = validateEnum(body.type, ['corrente', 'poupanca', 'carteira', 'digital', 'investimento', 'outros'], 'Tipo de conta');
      if (typeError) return jsonError(typeError);
      fields.type = body.type;
    }
    if (body.balance !== undefined) fields.balanceCents = toCents(body.balance);

    const account = await Accounts.updateAccount(db, userId, id, fields);
    if (!account) return jsonError('Conta não encontrada.', 404);
    return jsonOk({ account: serializeAccount(account) });
  }

  if (request.method === 'DELETE') {
    const ok = await Accounts.archiveAccount(db, userId, id);
    if (!ok) return jsonError('Conta não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

async function transfersRoute(request, db, userId) {
  if (request.method !== 'POST') return jsonError('Método não suportado.', 405);

  const body = await readJson(request);
  if (!body) return jsonError('Corpo da requisição inválido.');

  const errors = validateRequiredFields(body, ['fromAccountId', 'toAccountId', 'amount']);
  if (errors) return jsonError('Preencha os campos obrigatórios.');

  const amountCents = toCents(body.amount);
  if (!amountCents || amountCents <= 0) return jsonError('Valor da transferência inválido.');
  if (body.fromAccountId === body.toAccountId) return jsonError('As contas de origem e destino precisam ser diferentes.');

  const result = await Accounts.transferBetweenAccounts(db, userId, {
    fromAccountId: body.fromAccountId,
    toAccountId: body.toAccountId,
    amountCents
  });
  if (!result) return jsonError('Uma das contas informadas não foi encontrada.', 404);
  return jsonOk({ ok: true });
}

function serializeAccount(a) {
  return { id: a.id, name: a.name, type: a.type, balance: fromCents(a.balance_cents) };
}

// ---------- Cartões ----------

async function cardsRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const cards = await Cards.listCards(db, userId);
    const withCommitted = await Promise.all(cards.map(async c => ({
      ...serializeCard(c),
      committed: fromCents(await Cards.calculateCommittedLimit(db, userId, c.id))
    })));
    return jsonOk({ cards: withCommitted });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');

    const errors = validateRequiredFields(body, ['name', 'limit', 'closingDay', 'dueDay']);
    if (errors) return jsonError('Preencha os campos obrigatórios.');

    const closingDayError = validateRange(body.closingDay, 1, 31, 'Dia de fechamento');
    if (closingDayError) return jsonError(closingDayError);
    const dueDayError = validateRange(body.dueDay, 1, 31, 'Dia de vencimento');
    if (dueDayError) return jsonError(dueDayError);

    const limitCents = toCents(body.limit);
    if (limitCents === null || limitCents < 0) return jsonError('Limite inválido.');

    const card = await Cards.createCard(db, userId, {
      name: sanitizeText(body.name, { maxLength: 120 }),
      bank: body.bank ? sanitizeText(body.bank, { maxLength: 120 }) : null,
      brand: body.brand ? sanitizeText(body.brand, { maxLength: 60 }) : null,
      limitCents,
      closingDay: body.closingDay,
      dueDay: body.dueDay,
      isPrimary: !!body.isPrimary
    });
    return jsonOk({ card: serializeCard(card) }, 201);
  }

  if (!id) return jsonError('Informe o id do cartão.', 400);

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    const fields = {};
    if (body.name !== undefined) fields.name = sanitizeText(body.name, { maxLength: 120 });
    if (body.bank !== undefined) fields.bank = sanitizeText(body.bank, { maxLength: 120 });
    if (body.brand !== undefined) fields.brand = sanitizeText(body.brand, { maxLength: 60 });
    if (body.limit !== undefined) {
      const limitCents = toCents(body.limit);
      if (limitCents === null || limitCents < 0) return jsonError('Limite inválido.');
      fields.limitCents = limitCents;
    }
    if (body.closingDay !== undefined) {
      const closingDayError = validateRange(body.closingDay, 1, 31, 'Dia de fechamento');
      if (closingDayError) return jsonError(closingDayError);
      fields.closingDay = body.closingDay;
    }
    if (body.dueDay !== undefined) {
      const dueDayError = validateRange(body.dueDay, 1, 31, 'Dia de vencimento');
      if (dueDayError) return jsonError(dueDayError);
      fields.dueDay = body.dueDay;
    }

    const card = await Cards.updateCard(db, userId, id, fields);
    if (!card) return jsonError('Cartão não encontrado.', 404);
    return jsonOk({ card: serializeCard(card) });
  }

  if (request.method === 'DELETE') {
    const ok = await Cards.archiveCard(db, userId, id);
    if (!ok) return jsonError('Cartão não encontrado.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

function serializeCard(c) {
  return {
    id: c.id, name: c.name, bank: c.bank, brand: c.brand,
    limit: fromCents(c.limit_cents), closingDay: c.closing_day, dueDay: c.due_day
  };
}

// ---------- Categorias ----------

async function categoriesRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const categories = await Categories.listCategories(db, userId);
    return jsonOk({ categories });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');

    const errors = validateRequiredFields(body, ['name', 'kind']);
    if (errors) return jsonError('Preencha os campos obrigatórios.');
    if (!['receita', 'despesa'].includes(body.kind)) return jsonError('Tipo de categoria inválido.');

    const category = await Categories.createCategory(db, userId, {
      name: sanitizeText(body.name, { maxLength: 80 }),
      parentId: body.parentId || null,
      kind: body.kind
    });
    return jsonOk({ category }, 201);
  }

  if (request.method === 'DELETE') {
    if (!id) return jsonError('Informe o id da categoria.', 400);
    const ok = await Categories.archiveCategory(db, userId, id);
    if (!ok) return jsonError('Categoria não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- Transações ----------

async function transactionsRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const month = url.searchParams.get('month'); // formato 'YYYY-MM'
    const range = month
      ? { start: `${month}-01`, end: `${month}-31` }
      : currentMonthRange();

    const occurrences = await Transactions.listTransactionsInRange(db, userId, range);
    return jsonOk({
      transactions: occurrences.map(o => ({ ...o, amount: fromCents(o.amount_cents) }))
    });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');

    const errors = validateRequiredFields(body, ['description', 'amount', 'type', 'dueDate']);
    if (errors) return jsonError('Preencha os campos obrigatórios.');
    if (!['receita', 'despesa'].includes(body.type)) return jsonError('Tipo de transação inválido.');

    const amountCents = toCents(body.amount);
    if (!amountCents || amountCents <= 0) return jsonError('Valor da transação inválido.');

    if (body.installmentsTotal && (body.installmentsTotal < 1 || body.installmentsTotal > 60)) {
      return jsonError('Quantidade de parcelas inválida.');
    }

    const descriptionError = validateMaxLength(body.description, 200, 'Descrição');
    if (descriptionError) return jsonError(descriptionError);
    if (body.notes) {
      const notesError = validateMaxLength(body.notes, 2000, 'Observações');
      if (notesError) return jsonError(notesError);
    }
    if (body.valueKind !== undefined) {
      const valueKindError = validateEnum(body.valueKind, ['real', 'previsto', 'estimado', 'simulado'], 'Tipo de valor');
      if (valueKindError) return jsonError(valueKindError);
    }
    if (body.recurrence !== undefined && body.recurrence !== null) {
      const recurrenceError = validateEnum(body.recurrence, ['nenhuma', 'mensal', 'semanal', 'anual'], 'Recorrência');
      if (recurrenceError) return jsonError(recurrenceError);
    }

    const result = await Transactions.createTransaction(db, userId, {
      accountId: body.accountId || null,
      cardId: body.cardId || null,
      categoryId: body.categoryId || null,
      description: sanitizeText(body.description, { maxLength: 200 }),
      amountCents,
      type: body.type,
      valueKind: body.valueKind || 'real',
      dueDate: body.dueDate,
      recurrence: body.recurrence || null,
      installmentsTotal: body.installmentsTotal || 1,
      notes: body.notes ? sanitizeText(body.notes, { maxLength: 2000 }) : null
    });
    return jsonOk({ transaction: result }, 201);
  }

  if (!id) return jsonError('Informe o id da transação.', 400);

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    if (!body.status) return jsonError('Informe o novo status.');

    const ok = await Transactions.updateTransactionStatus(db, userId, id, {
      status: body.status,
      installmentId: body.installmentId || null
    });
    if (!ok) return jsonError('Transação não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  if (request.method === 'DELETE') {
    const ok = await Transactions.deleteTransaction(db, userId, id);
    if (!ok) return jsonError('Transação não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- Orçamento ----------

async function budgetsRoute(request, db, userId) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const period = url.searchParams.get('period');
    if (!period) return jsonError('Informe o período (ex.: ?period=2026-08).');
    const periodError = validateMonthFormat(period);
    if (periodError) return jsonError(periodError);
    const status = await Budgets.budgetStatusForPeriod(db, userId, period);
    return jsonOk({
      budgets: status.map(b => ({
        ...b,
        planned: fromCents(b.planned_cents),
        realized: fromCents(b.realized_cents),
        remaining: fromCents(b.remaining_cents),
        noLimitDefined: b.no_limit_defined
      }))
    });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');

    const errors = validateRequiredFields(body, ['categoryId', 'period', 'planned']);
    if (errors) return jsonError('Preencha os campos obrigatórios.');

    const periodError = validateMonthFormat(body.period);
    if (periodError) return jsonError(periodError);

    const plannedCents = toCents(body.planned);
    if (plannedCents === null || plannedCents < 0) return jsonError('Valor planejado inválido.');

    const budget = await Budgets.upsertBudget(db, userId, {
      categoryId: body.categoryId,
      period: body.period,
      plannedCents
    });
    return jsonOk({ budget: { ...budget, planned: fromCents(budget.planned_cents) } }, 201);
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- Helper ----------

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
