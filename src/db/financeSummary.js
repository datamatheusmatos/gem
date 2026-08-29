// Agregações puras de leitura, usadas pelo FinancialEngine. Nenhuma fórmula
// financeira mora aqui — só soma o que já existe no banco.

export async function sumIncomeInRange(db, userId, { start, end }) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) as total FROM transactions
     WHERE user_id = ? AND type = 'receita' AND is_installment = 0 AND due_date BETWEEN ? AND ?`
  ).bind(userId, start, end).first();
  return row.total;
}

// Despesas do período, somando avulsas + parcelas (independente de já pagas ou
// ainda previstas — seção 2 do produto trata as duas como comprometimento do mês).
export async function sumExpensesInRange(db, userId, { start, end }) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) as total FROM (
        SELECT amount_cents FROM transactions
        WHERE user_id = ? AND type = 'despesa' AND is_installment = 0 AND due_date BETWEEN ? AND ?
        UNION ALL
        SELECT i.amount_cents FROM installments i
        JOIN transactions t ON t.id = i.transaction_id
        WHERE t.user_id = ? AND t.type = 'despesa' AND t.is_installment = 1 AND i.due_date BETWEEN ? AND ?
     )`
  ).bind(userId, start, end, userId, start, end).first();
  return row.total;
}

export async function listActiveDebts(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM debts WHERE user_id = ? AND archived = 0 AND installments_paid < installments_total'
  ).bind(userId).all();
  return results;
}

export async function listActiveGoals(db, userId) {
  const { results } = await db.prepare(
    "SELECT * FROM goals WHERE user_id = ? AND status = 'ativa'"
  ).bind(userId).all();
  return results;
}

export async function sumInvestmentContributionsInRange(db, userId, { start, end }) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(im.amount_cents), 0) as total
     FROM investment_movements im
     JOIN investments i ON i.id = im.investment_id
     WHERE i.user_id = ? AND im.type = 'aporte' AND im.date BETWEEN ? AND ?`
  ).bind(userId, start, end).first();
  return row.total;
}

export async function getSafetyMarginCents(db, userId) {
  const row = await db.prepare('SELECT safety_margin_cents FROM user_settings WHERE user_id = ?').bind(userId).first();
  return row ? row.safety_margin_cents : 0;
}

export async function sumAccountBalances(db, userId) {
  const row = await db.prepare(
    "SELECT COALESCE(SUM(balance_cents), 0) as total FROM accounts WHERE user_id = ? AND archived = 0"
  ).bind(userId).first();
  return row.total;
}

export async function sumInvestmentValue(db, userId) {
  const row = await db.prepare(
    'SELECT COALESCE(SUM(current_value_cents), 0) as total FROM investments WHERE user_id = ? AND archived = 0'
  ).bind(userId).first();
  return row.total;
}

export async function sumDebtRemaining(db, userId) {
  const row = await db.prepare(
    'SELECT COALESCE(SUM(remaining_amount_cents), 0) as total FROM debts WHERE user_id = ? AND archived = 0'
  ).bind(userId).first();
  return row.total;
}

// Recorrências mensais (receita e despesa) usadas para projetar meses futuros
// que ainda não têm transações lançadas.
export async function listMonthlyRecurringTransactions(db, userId) {
  const { results } = await db.prepare(
    "SELECT * FROM transactions WHERE user_id = ? AND recurrence = 'mensal' AND is_installment = 0"
  ).bind(userId).all();
  return results;
}
