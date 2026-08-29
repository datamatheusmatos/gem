export async function listTasksDueOn(db, userId, date) {
  const { results } = await db.prepare(
    'SELECT * FROM tasks WHERE user_id = ? AND due_date = ? AND done = 0 ORDER BY importance DESC, urgency DESC'
  ).bind(userId, date).all();
  return results;
}

export async function listOpenTasks(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM tasks WHERE user_id = ? AND done = 0 ORDER BY due_date IS NULL, due_date'
  ).bind(userId).all();
  return results;
}

export async function createTask(db, userId, payload) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO tasks (id, user_id, title, importance, urgency, effort_minutes, due_date, project_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, payload.title, payload.importance || 3, payload.urgency || 3,
    payload.effortMinutes || null, payload.dueDate || null, payload.projectId || null
  ).run();
  return db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
}

export async function updateTask(db, userId, id, fields) {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!task) return null;

  const merged = {
    title: fields.title ?? task.title,
    importance: fields.importance ?? task.importance,
    urgency: fields.urgency ?? task.urgency,
    effort_minutes: fields.effortMinutes ?? task.effort_minutes,
    due_date: fields.dueDate ?? task.due_date,
    done: fields.done !== undefined ? (fields.done ? 1 : 0) : task.done
  };

  await db.prepare(
    'UPDATE tasks SET title = ?, importance = ?, urgency = ?, effort_minutes = ?, due_date = ?, done = ? WHERE id = ?'
  ).bind(merged.title, merged.importance, merged.urgency, merged.effort_minutes, merged.due_date, merged.done, id).run();

  return { ...task, ...merged };
}

export async function deleteTask(db, userId, id) {
  const result = await db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}
