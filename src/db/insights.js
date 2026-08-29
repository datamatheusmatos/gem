export async function saveInsights(db, userId, insights) {
  if (insights.length === 0) return;

  // Deduplicação: não insere um insight se já existe um igual (mesmo domain +
  // mesma mensagem) criado no mesmo dia. Sem isso, chamar /generate mais de
  // uma vez por dia (o que o app faz naturalmente a cada carregamento do
  // Dashboard) empilha o mesmo aviso indefinidamente.
  const today = new Date().toISOString().slice(0, 10);
  const { results: existingToday } = await db.prepare(
    `SELECT domain, message FROM insights WHERE user_id = ? AND date(created_at) = ?`
  ).bind(userId, today).all();
  const existingKeys = new Set(existingToday.map(e => `${e.domain}::${e.message}`));

  const newInsights = insights.filter(i => !existingKeys.has(`${i.domain}::${i.message}`));
  if (newInsights.length === 0) return;

  const statements = newInsights.map(i =>
    db.prepare('INSERT INTO insights (id, user_id, domain, message, data_json) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, i.domain, i.message, JSON.stringify(i.data || {}))
  );
  await db.batch(statements);
}

export async function listRecentInsights(db, userId, limit = 20) {
  const { results } = await db.prepare(
    'SELECT * FROM insights WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(userId, limit).all();
  return results;
}
