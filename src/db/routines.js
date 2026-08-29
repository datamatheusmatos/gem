export async function listRoutines(db, userId) {
  const { results } = await db.prepare('SELECT * FROM routines WHERE user_id = ?').bind(userId).all();
  return results;
}

export async function createRoutine(db, userId, { name, period }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO routines (id, user_id, name, period) VALUES (?, ?, ?, ?)').bind(id, userId, name, period).run();
  return { id, user_id: userId, name, period };
}

export async function addRoutineStep(db, routineId, { title, orderIndex }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO routine_steps (id, routine_id, title, order_index) VALUES (?, ?, ?, ?)')
    .bind(id, routineId, title, orderIndex).run();
  return { id, routine_id: routineId, title, order_index: orderIndex };
}

export async function listRoutineSteps(db, routineId) {
  const { results } = await db.prepare('SELECT * FROM routine_steps WHERE routine_id = ? ORDER BY order_index').bind(routineId).all();
  return results;
}

// Registra quantas etapas foram concluídas num dia — comparação planejado x
// realizado (seção 26) vem de completed_steps/total_steps.
export async function logRoutineExecution(db, routineId, date, completedSteps) {
  const steps = await listRoutineSteps(db, routineId);
  const totalSteps = steps.length;

  const existing = await db.prepare('SELECT * FROM routine_logs WHERE routine_id = ? AND date = ?').bind(routineId, date).first();
  if (existing) {
    await db.prepare('UPDATE routine_logs SET completed_steps = ?, total_steps = ? WHERE id = ?')
      .bind(completedSteps, totalSteps, existing.id).run();
    return { ...existing, completed_steps: completedSteps, total_steps: totalSteps };
  }

  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO routine_logs (id, routine_id, date, completed_steps, total_steps) VALUES (?, ?, ?, ?, ?)')
    .bind(id, routineId, date, completedSteps, totalSteps).run();
  return { id, routine_id: routineId, date, completed_steps: completedSteps, total_steps: totalSteps };
}

export async function listRoutineLogsInRange(db, routineId, { start, end }) {
  const { results } = await db.prepare(
    'SELECT * FROM routine_logs WHERE routine_id = ? AND date BETWEEN ? AND ? ORDER BY date'
  ).bind(routineId, start, end).all();
  return results;
}
