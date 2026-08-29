export async function upsertBudget(db, userId, { categoryId, period, plannedCents }) {
  const existing = await db.prepare('SELECT * FROM budgets WHERE category_id = ? AND period = ?')
    .bind(categoryId, period).first();

  if (existing) {
    await db.prepare('UPDATE budgets SET planned_cents = ? WHERE id = ?').bind(plannedCents, existing.id).run();
    return { ...existing, planned_cents: plannedCents };
  }

  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO budgets (id, user_id, category_id, period, planned_cents) VALUES (?, ?, ?, ?, ?)')
    .bind(id, userId, categoryId, period, plannedCents).run();
  return { id, user_id: userId, category_id: categoryId, period, planned_cents: plannedCents };
}

// Retorna, por categoria, planejado x realizado no período — base do card de
// orçamento (seção 9): "Você já utilizou 82% do orçamento de lazer...".
export async function budgetStatusForPeriod(db, userId, period) {
  const { start, end } = periodToRange(period);
  const { results } = await db.prepare(
    `SELECT
        b.id as budget_id, b.category_id, c.name as category_name, b.planned_cents,
        COALESCE((
          SELECT SUM(amount_cents) FROM (
            SELECT t.amount_cents FROM transactions t
            WHERE t.category_id = b.category_id AND t.user_id = ? AND t.is_installment = 0
              AND t.type = 'despesa' AND t.due_date BETWEEN ? AND ?
            UNION ALL
            SELECT i.amount_cents FROM installments i
            JOIN transactions t2 ON t2.id = i.transaction_id
            WHERE t2.category_id = b.category_id AND t2.user_id = ? AND t2.is_installment = 1
              AND t2.type = 'despesa' AND i.due_date BETWEEN ? AND ?
          )
        ), 0) as realized_cents
      FROM budgets b
      JOIN categories c ON c.id = b.category_id
      WHERE b.user_id = ? AND b.period = ?`
  ).bind(userId, start, end, userId, start, end, userId, period).all();

  return results.map(row => {
    // Quando não há limite definido (planned=0) mas existe gasto real, "0%
    // usado" seria enganoso — sinalizamos como "sem limite definido" em vez
    // de esconder que o gasto está descontrolado atrás de um 0%.
    const noLimitButSpent = row.planned_cents === 0 && row.realized_cents > 0;
    return {
      ...row,
      remaining_cents: row.planned_cents - row.realized_cents,
      percent_used: noLimitButSpent ? null : (row.planned_cents > 0 ? Math.round((row.realized_cents / row.planned_cents) * 100) : 0),
      no_limit_defined: noLimitButSpent
    };
  });
}

function periodToRange(period) {
  const [year, month] = period.split('-').map(Number);
  const start = `${period}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
}
