export async function listHabits(db, userId) {
  const { results } = await db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0').bind(userId).all();
  return results;
}

export async function createHabit(db, userId, { name, frequency }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO habits (id, user_id, name, frequency) VALUES (?, ?, ?, ?)')
    .bind(id, userId, name, frequency).run();
  return { id, user_id: userId, name, frequency };
}

// Um log por dia por hábito (índice único no schema) — marca/desmarca é upsert.
export async function toggleHabitLog(db, habitId, date, done) {
  const existing = await db.prepare('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?').bind(habitId, date).first();
  if (existing) {
    await db.prepare('UPDATE habit_logs SET done = ? WHERE id = ?').bind(done ? 1 : 0, existing.id).run();
    return { ...existing, done: done ? 1 : 0 };
  }
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO habit_logs (id, habit_id, date, done) VALUES (?, ?, ?, ?)').bind(id, habitId, date, done ? 1 : 0).run();
  return { id, habit_id: habitId, date, done: done ? 1 : 0 };
}

export async function listHabitLogsInRange(db, habitId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM habit_logs WHERE habit_id = ? AND date BETWEEN ? AND ? ORDER BY date'
  ).bind(habitId, start, end).all();
  return results;
}
