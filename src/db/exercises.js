export async function listExercisesByGroup(db, muscleGroup) {
  const { results } = await db.prepare('SELECT * FROM exercises WHERE muscle_group = ?').bind(muscleGroup).all();
  return results;
}

export async function listAllExercises(db) {
  const { results } = await db.prepare('SELECT * FROM exercises ORDER BY muscle_group, difficulty').all();
  return results;
}

export async function listExcludedIds(db, userId) {
  const { results } = await db.prepare('SELECT exercise_id FROM excluded_exercises WHERE user_id = ?').bind(userId).all();
  return results.map(r => r.exercise_id);
}

export async function excludeExercise(db, userId, exerciseId, reason) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT OR IGNORE INTO excluded_exercises (id, user_id, exercise_id, reason) VALUES (?, ?, ?, ?)')
    .bind(id, userId, exerciseId, reason || null).run();
  return { id, exerciseId };
}

export async function unexcludeExercise(db, userId, exerciseId) {
  const result = await db.prepare('DELETE FROM excluded_exercises WHERE user_id = ? AND exercise_id = ?').bind(userId, exerciseId).run();
  return result.meta.changes > 0;
}

export async function listExcludedWithDetails(db, userId) {
  const { results } = await db.prepare(
    `SELECT e.id, e.name, e.muscle_group, x.reason FROM excluded_exercises x
     JOIN exercises e ON e.id = x.exercise_id WHERE x.user_id = ?`
  ).bind(userId).all();
  return results;
}
