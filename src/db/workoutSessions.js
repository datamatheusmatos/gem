export async function listRecentSessions(db, userId, limit = 5) {
  const { results } = await db.prepare(
    'SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY date DESC LIMIT ?'
  ).bind(userId, limit).all();
  return results;
}

export async function listSessionsInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM workout_sessions WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC'
  ).bind(userId, start, end).all();
  return results;
}

export async function getSessionExercises(db, sessionId) {
  const { results } = await db.prepare(
    `SELECT wse.*, e.name, e.muscle_group FROM workout_session_exercises wse
     JOIN exercises e ON e.id = wse.exercise_id WHERE wse.workout_session_id = ? ORDER BY wse.order_index`
  ).bind(sessionId).all();
  return results;
}

// Últimos registros de cada exercício (para a progressão) — olha os últimos
// N dias de sessões do usuário e traz todas as linhas de exercício já feitas.
export async function listRecentExerciseLogs(db, userId, sinceDate) {
  const { results } = await db.prepare(
    `SELECT wse.exercise_id, wse.sets, wse.reps, ws.date FROM workout_session_exercises wse
     JOIN workout_sessions ws ON ws.id = wse.workout_session_id
     WHERE ws.user_id = ? AND ws.date >= ? ORDER BY ws.date DESC`
  ).bind(userId, sinceDate).all();
  return results;
}

export async function createSession(db, userId, { date, muscleGroups, durationMinutes, perceivedEffort, exercises }) {
  const sessionId = crypto.randomUUID();
  const statements = [
    db.prepare(
      'INSERT INTO workout_sessions (id, user_id, date, muscle_groups, duration_minutes, perceived_effort) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(sessionId, userId, date, muscleGroups, durationMinutes || null, perceivedEffort || null)
  ];

  exercises.forEach((ex, index) => {
    statements.push(
      db.prepare(
        'INSERT INTO workout_session_exercises (id, workout_session_id, exercise_id, sets, reps, order_index) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), sessionId, ex.exerciseId, ex.sets, ex.reps, index)
    );
  });

  await db.batch(statements);
  return { id: sessionId };
}

export async function deleteSession(db, userId, sessionId) {
  const result = await db.prepare('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?').bind(sessionId, userId).run();
  return result.meta.changes > 0; // cascade remove os exercícios da sessão
}
