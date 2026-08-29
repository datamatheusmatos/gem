export async function listGoals(db, userId) {
  const { results } = await db.prepare(
    "SELECT * FROM goals WHERE user_id = ? AND status != 'concluida' ORDER BY priority, deadline"
  ).bind(userId).all();
  return results;
}

export async function createGoal(db, userId, payload) {
  const id = crypto.randomUUID();
  const targetCents = payload.targetAmountCents || null;
  const currentCents = payload.currentAmountCents || 0;
  // Mesma regra aplicada em addContribution: se a meta já nasce com o valor
  // atingido (ex.: usuário já tinha o dinheiro guardado ao cadastrar), ela
  // já nasce concluída — sem isso, ficaria presa na lista de metas ativas
  // para sempre, só sendo reavaliada numa contribuição futura.
  const initialStatus = targetCents && currentCents >= targetCents ? 'concluida' : 'ativa';

  await db.prepare(
    `INSERT INTO goals
      (id, user_id, name, category, target_amount_cents, current_amount_cents, deadline,
       priority, monthly_contribution_cents, status, metric, progress_current, progress_target)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, payload.name, payload.category || null,
    targetCents, currentCents, payload.deadline || null,
    payload.priority || 3, payload.monthlyContributionCents || null, initialStatus,
    payload.metric || null, payload.progressCurrent ?? null, payload.progressTarget ?? null
  ).run();

  return getGoalById(db, userId, id);
}

export async function getGoalById(db, userId, id) {
  return db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').bind(id, userId).first();
}

export async function updateGoal(db, userId, id, fields) {
  const goal = await getGoalById(db, userId, id);
  if (!goal) return null;

  const merged = {
    name: fields.name ?? goal.name,
    category: fields.category ?? goal.category,
    target_amount_cents: fields.targetAmountCents ?? goal.target_amount_cents,
    deadline: fields.deadline ?? goal.deadline,
    priority: fields.priority ?? goal.priority,
    monthly_contribution_cents: fields.monthlyContributionCents ?? goal.monthly_contribution_cents,
    progress_current: fields.progressCurrent ?? goal.progress_current,
    progress_target: fields.progressTarget ?? goal.progress_target,
    status: fields.status ?? goal.status
  };

  await db.prepare(
    `UPDATE goals SET name = ?, category = ?, target_amount_cents = ?, deadline = ?, priority = ?,
       monthly_contribution_cents = ?, progress_current = ?, progress_target = ?, status = ?
     WHERE id = ?`
  ).bind(
    merged.name, merged.category, merged.target_amount_cents, merged.deadline, merged.priority,
    merged.monthly_contribution_cents, merged.progress_current, merged.progress_target, merged.status, id
  ).run();

  return { ...goal, ...merged };
}

// Registra uma contribuição e já atualiza o valor acumulado da meta (mesma
// transação lógica — evita a meta e o histórico de contribuições divergirem).
export async function addContribution(db, userId, goalId, { amountCents, date }) {
  const goal = await getGoalById(db, userId, goalId);
  if (!goal) return null;

  const contributionId = crypto.randomUUID();
  const newAmount = goal.current_amount_cents + amountCents;
  const newStatus = goal.target_amount_cents && newAmount >= goal.target_amount_cents ? 'concluida' : goal.status;

  await db.batch([
    db.prepare('INSERT INTO goal_contributions (id, goal_id, amount_cents, date) VALUES (?, ?, ?, ?)')
      .bind(contributionId, goalId, amountCents, date),
    db.prepare('UPDATE goals SET current_amount_cents = ?, status = ? WHERE id = ?')
      .bind(newAmount, newStatus, goalId)
  ]);

  return { ...goal, current_amount_cents: newAmount, status: newStatus };
}

export async function listContributions(db, goalId) {
  const { results } = await db.prepare(
    'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY date DESC'
  ).bind(goalId).all();
  return results;
}
