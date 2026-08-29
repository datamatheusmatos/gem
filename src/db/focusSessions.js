export async function createFocusSession(db, userId, payload) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO focus_sessions (id, user_id, project_id, objective, duration_minutes, interruptions, perceived_productivity, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, payload.projectId || null, payload.objective || null, payload.durationMinutes,
    payload.interruptions || 0, payload.perceivedProductivity ?? null, payload.startedAt
  ).run();
  return db.prepare('SELECT * FROM focus_sessions WHERE id = ?').bind(id).first();
}

export async function listFocusSessionsInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM focus_sessions WHERE user_id = ? AND started_at BETWEEN ? AND ? ORDER BY started_at'
  ).bind(userId, start, end).all();
  return results;
}

export async function deleteFocusSession(db, userId, id) {
  const result = await db.prepare('DELETE FROM focus_sessions WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}
