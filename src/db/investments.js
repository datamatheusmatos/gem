export async function listInvestments(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM investments WHERE user_id = ? AND archived = 0 ORDER BY category, name'
  ).bind(userId).all();
  return results;
}

export async function createInvestment(db, userId, payload) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO investments (id, user_id, name, category, institution, quantity, avg_price_cents, current_value_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, payload.name, payload.category, payload.institution || null,
    payload.quantity || 0, payload.avgPriceCents || 0, payload.currentValueCents || 0
  ).run();
  return db.prepare('SELECT * FROM investments WHERE id = ?').bind(id).first();
}

export async function updateInvestment(db, userId, id, fields) {
  const investment = await db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ? AND archived = 0').bind(id, userId).first();
  if (!investment) return null;

  const merged = {
    name: fields.name ?? investment.name,
    institution: fields.institution ?? investment.institution,
    quantity: fields.quantity ?? investment.quantity,
    avg_price_cents: fields.avgPriceCents ?? investment.avg_price_cents,
    current_value_cents: fields.currentValueCents ?? investment.current_value_cents
  };

  await db.prepare(
    'UPDATE investments SET name = ?, institution = ?, quantity = ?, avg_price_cents = ?, current_value_cents = ? WHERE id = ?'
  ).bind(merged.name, merged.institution, merged.quantity, merged.avg_price_cents, merged.current_value_cents, id).run();

  return { ...investment, ...merged };
}

export async function archiveInvestment(db, userId, id) {
  const result = await db.prepare('UPDATE investments SET archived = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}

// Registra aporte/resgate e atualiza current_value_cents e quantity na mesma
// operação — mesmo padrão de consistência usado em goals.js e debts.js.
export async function recordMovement(db, userId, investmentId, { type, amountCents, quantity, date }) {
  const investment = await db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ? AND archived = 0').bind(investmentId, userId).first();
  if (!investment) return null;

  const movementId = crypto.randomUUID();
  const sign = type === 'aporte' ? 1 : -1;
  const newValue = Math.max(investment.current_value_cents + sign * amountCents, 0);
  const newQuantity = quantity ? investment.quantity + sign * quantity : investment.quantity;

  await db.batch([
    db.prepare('INSERT INTO investment_movements (id, investment_id, type, amount_cents, quantity, date) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(movementId, investmentId, type, amountCents, quantity || null, date),
    db.prepare('UPDATE investments SET current_value_cents = ?, quantity = ? WHERE id = ?')
      .bind(newValue, newQuantity, investmentId)
  ]);

  return { ...investment, current_value_cents: newValue, quantity: newQuantity };
}

export async function listMovements(db, investmentId) {
  const { results } = await db.prepare('SELECT * FROM investment_movements WHERE investment_id = ? ORDER BY date DESC').bind(investmentId).all();
  return results;
}
