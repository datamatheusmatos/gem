export async function listCards(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM cards WHERE user_id = ? AND archived = 0 ORDER BY created_at'
  ).bind(userId).all();
  return results;
}

export async function createCard(db, userId, { name, bank, brand, limitCents, closingDay, dueDay, isPrimary }) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO cards (id, user_id, name, bank, brand, limit_cents, closing_day, due_day, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, name, bank || null, brand || null, limitCents, closingDay, dueDay, isPrimary ? 1 : 0).run();
  return { id, user_id: userId, name, bank, brand, limit_cents: limitCents, closing_day: closingDay, due_day: dueDay };
}

export async function updateCard(db, userId, id, fields) {
  const card = await db.prepare('SELECT * FROM cards WHERE id = ? AND user_id = ? AND archived = 0').bind(id, userId).first();
  if (!card) return null;

  const merged = {
    name: fields.name ?? card.name,
    bank: fields.bank ?? card.bank,
    brand: fields.brand ?? card.brand,
    limit_cents: fields.limitCents ?? card.limit_cents,
    closing_day: fields.closingDay ?? card.closing_day,
    due_day: fields.dueDay ?? card.due_day
  };

  await db.prepare(
    'UPDATE cards SET name = ?, bank = ?, brand = ?, limit_cents = ?, closing_day = ?, due_day = ? WHERE id = ?'
  ).bind(merged.name, merged.bank, merged.brand, merged.limit_cents, merged.closing_day, merged.due_day, id).run();

  return { ...card, ...merged };
}

export async function archiveCard(db, userId, id) {
  const result = await db.prepare('UPDATE cards SET archived = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}

// Limite comprometido = soma das parcelas futuras ainda não pagas deste cartão.
export async function calculateCommittedLimit(db, userId, cardId) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(i.amount_cents), 0) as committed
     FROM installments i
     JOIN transactions t ON t.id = i.transaction_id
     WHERE t.card_id = ? AND t.user_id = ? AND i.status = 'previsto'`
  ).bind(cardId, userId).first();
  return row.committed;
}
