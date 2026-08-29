export async function saveNotifications(db, userId, alerts) {
  if (alerts.length === 0) return;

  // Mesma deduplicação dos insights: não repete o mesmo alerta (categoria +
  // mensagem) já criado hoje, para não gerar spam de notificações (seção 28
  // exige explicitamente que alertas "não devem gerar spam").
  const today = new Date().toISOString().slice(0, 10);
  const { results: existingToday } = await db.prepare(
    `SELECT category, message FROM notifications WHERE user_id = ? AND date(created_at) = ?`
  ).bind(userId, today).all();
  const existingKeys = new Set(existingToday.map(e => `${e.category}::${e.message}`));

  const newAlerts = alerts.filter(a => !existingKeys.has(`${a.category}::${a.message}`));
  if (newAlerts.length === 0) return;

  const statements = newAlerts.map(a =>
    db.prepare('INSERT INTO notifications (id, user_id, message, level, category) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, a.message, a.level, a.category)
  );
  await db.batch(statements);
}

export async function listUnreadNotifications(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC'
  ).bind(userId).all();
  return results;
}

export async function markNotificationRead(db, userId, id) {
  const result = await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}
