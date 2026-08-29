// Agregações de leitura usadas só pelos relatórios — nada aqui é usado pelo
// FinancialEngine (que tem suas próprias agregações em financeSummary.js).

export async function expensesByCategoryInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    `SELECT c.id as category_id, c.name as category_name, SUM(amount_cents) as total_cents FROM (
        SELECT category_id, amount_cents FROM transactions
        WHERE user_id = ? AND type = 'despesa' AND is_installment = 0 AND due_date BETWEEN ? AND ?
        UNION ALL
        SELECT t.category_id, i.amount_cents FROM installments i
        JOIN transactions t ON t.id = i.transaction_id
        WHERE t.user_id = ? AND t.type = 'despesa' AND t.is_installment = 1 AND i.due_date BETWEEN ? AND ?
     ) e
     JOIN categories c ON c.id = e.category_id
     GROUP BY c.id, c.name
     ORDER BY total_cents DESC`
  ).bind(userId, start, end, userId, start, end).all();
  return results;
}

export async function studyHoursInRange(db, userId, { start, end }) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(s.minutes), 0) as total_minutes
     FROM study_sessions s
     JOIN study_items i ON i.id = s.study_item_id
     WHERE i.user_id = ? AND s.date BETWEEN ? AND ?`
  ).bind(userId, start, end).first();
  return row.total_minutes;
}

export async function habitsComplianceSummary(db, userId, { start, end }) {
  const { results: habits } = await db.prepare('SELECT * FROM habits WHERE user_id = ? AND archived = 0').bind(userId).all();
  if (habits.length === 0) return { habit_count: 0, avg_compliance: null };

  const periodDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  let totalRate = 0;

  for (const h of habits) {
    const { results: logs } = await db.prepare(
      'SELECT done FROM habit_logs WHERE habit_id = ? AND date BETWEEN ? AND ?'
    ).bind(h.id, start, end).all();

    const expected = h.frequency === 'diario' ? periodDays : h.frequency === 'semanal' ? Math.ceil(periodDays / 7) : Math.ceil(periodDays / 30);
    const done = logs.filter(l => l.done).length;
    const rate = expected > 0 ? Math.min(Math.round((done / expected) * 100), 100) : 0;
    totalRate += rate;
  }

  return { habit_count: habits.length, avg_compliance: Math.round(totalRate / habits.length) };
}

export async function projectsProgressSummary(db, userId) {
  const { results } = await db.prepare(
    "SELECT name, progress, status FROM projects WHERE user_id = ? AND status != 'concluido'"
  ).bind(userId).all();
  return results;
}
