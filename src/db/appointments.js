export async function listAppointmentsInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM appointments WHERE user_id = ? AND start_at BETWEEN ? AND ? ORDER BY start_at'
  ).bind(userId, start, end).all();
  return results;
}

export async function createAppointment(db, userId, { title, startAt, endAt, location }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO appointments (id, user_id, title, start_at, end_at, location) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, title, startAt, endAt, location || null).run();
  return db.prepare('SELECT * FROM appointments WHERE id = ?').bind(id).first();
}

export async function deleteAppointment(db, userId, id) {
  const result = await db.prepare('DELETE FROM appointments WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}
