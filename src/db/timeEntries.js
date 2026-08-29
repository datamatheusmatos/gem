export async function createTimeEntry(db, userId, { category, minutes, date, notes }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO time_entries (id, user_id, category, minutes, date, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, category, minutes, date, notes || null).run();
  return { id, user_id: userId, category, minutes, date, notes };
}

export async function listTimeEntriesInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM time_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date'
  ).bind(userId, start, end).all();
  return results;
}

export async function deleteTimeEntry(db, userId, id) {
  const result = await db.prepare('DELETE FROM time_entries WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}
