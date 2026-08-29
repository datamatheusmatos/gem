export async function listProjects(db, userId) {
  const { results } = await db.prepare(
    "SELECT * FROM projects WHERE user_id = ? AND status != 'concluido' ORDER BY priority, deadline"
  ).bind(userId).all();
  return results;
}

export async function createProject(db, userId, payload) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO projects (id, user_id, name, objective, deadline, budget_cents, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')`
  ).bind(id, userId, payload.name, payload.objective || null, payload.deadline || null, payload.budgetCents || null, payload.priority || 3).run();
  return db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
}

export async function listProjectTasks(db, projectId) {
  const { results } = await db.prepare('SELECT * FROM project_tasks WHERE project_id = ? ORDER BY due_date').bind(projectId).all();
  return results;
}

export async function createProjectTask(db, projectId, { title, dueDate }) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO project_tasks (id, project_id, title, due_date) VALUES (?, ?, ?, ?)')
    .bind(id, projectId, title, dueDate || null).run();
  return db.prepare('SELECT * FROM project_tasks WHERE id = ?').bind(id).first();
}

// Marca tarefa concluída/pendente e recalcula automaticamente o progresso do
// projeto (feitas/total) — o progresso nunca é digitado manualmente quando há
// tarefas cadastradas, evitando o número da UI divergir da lista real.
export async function toggleProjectTask(db, taskId, done) {
  const task = await db.prepare('SELECT * FROM project_tasks WHERE id = ?').bind(taskId).first();
  if (!task) return null;

  await db.prepare('UPDATE project_tasks SET done = ? WHERE id = ?').bind(done ? 1 : 0, taskId).run();

  const { results } = await db.prepare('SELECT done FROM project_tasks WHERE project_id = ?').bind(task.project_id).all();
  const total = results.length;
  const doneCount = results.filter(r => r.done).length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  await db.prepare('UPDATE projects SET progress = ? WHERE id = ?').bind(progress, task.project_id).run();
  return { taskId, projectId: task.project_id, progress };
}
