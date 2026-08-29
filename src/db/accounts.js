export async function listAccounts(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM accounts WHERE user_id = ? AND archived = 0 ORDER BY created_at'
  ).bind(userId).all();
  return results;
}

export async function createAccount(db, userId, { name, type, balanceCents }) {
  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO accounts (id, user_id, name, type, balance_cents) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, name, type, balanceCents || 0).run();
  return { id, user_id: userId, name, type, balance_cents: balanceCents || 0 };
}

export async function updateAccount(db, userId, id, fields) {
  const account = await db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ? AND archived = 0').bind(id, userId).first();
  if (!account) return null;

  const name = fields.name ?? account.name;
  const type = fields.type ?? account.type;
  const balanceCents = fields.balanceCents ?? account.balance_cents;

  await db.prepare('UPDATE accounts SET name = ?, type = ?, balance_cents = ? WHERE id = ?')
    .bind(name, type, balanceCents, id).run();
  return { ...account, name, type, balance_cents: balanceCents };
}

export async function archiveAccount(db, userId, id) {
  const result = await db.prepare('UPDATE accounts SET archived = 1 WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();
  return result.meta.changes > 0;
}

// Transferência não é receita nem despesa (seção 8): ajusta os dois saldos numa
// transação e não cria linha em `transactions`.
export async function transferBetweenAccounts(db, userId, { fromAccountId, toAccountId, amountCents }) {
  const from = await db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').bind(fromAccountId, userId).first();
  const to = await db.prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?').bind(toAccountId, userId).first();
  if (!from || !to) return null;

  await db.batch([
    db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').bind(amountCents, fromAccountId),
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').bind(amountCents, toAccountId)
  ]);

  return { fromAccountId, toAccountId, amountCents };
}
