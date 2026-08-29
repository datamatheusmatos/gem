export async function listStudyItems(db, userId) {
  const { results } = await db.prepare(
    "SELECT * FROM study_items WHERE user_id = ? AND status != 'concluido' ORDER BY priority, deadline"
  ).bind(userId).all();
  return results;
}

export async function createStudyItem(db, userId, payload) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO study_items (id, user_id, name, institution, total_hours, deadline, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'em_andamento')`
  ).bind(id, userId, payload.name, payload.institution || null, payload.totalHours || null, payload.deadline || null, payload.priority || 3).run();
  return db.prepare('SELECT * FROM study_items WHERE id = ?').bind(id).first();
}

export async function addStudySession(db, userId, studyItemId, { minutes, date }) {
  const item = await db.prepare('SELECT * FROM study_items WHERE id = ? AND user_id = ?').bind(studyItemId, userId).first();
  if (!item) return null;

  const sessionId = crypto.randomUUID();
  const newHoursDone = item.hours_done + minutes / 60;

  await db.batch([
    db.prepare('INSERT INTO study_sessions (id, study_item_id, minutes, date) VALUES (?, ?, ?, ?)')
      .bind(sessionId, studyItemId, minutes, date),
    db.prepare('UPDATE study_items SET hours_done = ? WHERE id = ?').bind(newHoursDone, studyItemId)
  ]);

  return { ...item, hours_done: newHoursDone };
}

export async function listRecentStudySessions(db, studyItemId, sinceDate) {
  const { results } = await db.prepare(
    'SELECT * FROM study_sessions WHERE study_item_id = ? AND date >= ? ORDER BY date'
  ).bind(studyItemId, sinceDate).all();
  return results;
}
