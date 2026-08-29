export async function listActiveDebtsFull(db, userId) {
  const { results } = await db.prepare(
    'SELECT * FROM debts WHERE user_id = ? AND archived = 0 ORDER BY due_day'
  ).bind(userId).all();
  return results;
}

export async function createDebt(db, userId, payload) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO debts
      (id, user_id, name, institution, original_amount_cents, remaining_amount_cents, rate_monthly,
       amortization_system, installments_total, installments_paid, installment_amount_cents, start_date, due_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, payload.name, payload.institution || null,
    payload.originalAmountCents, payload.remainingAmountCents,
    payload.rateMonthly || 0, payload.amortizationSystem || null,
    payload.installmentsTotal, payload.installmentsPaid || 0,
    payload.installmentAmountCents, payload.startDate, payload.dueDay
  ).run();
  return db.prepare('SELECT * FROM debts WHERE id = ?').bind(id).first();
}

export async function updateDebt(db, userId, id, fields) {
  const debt = await db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ? AND archived = 0').bind(id, userId).first();
  if (!debt) return null;

  const merged = {
    name: fields.name ?? debt.name,
    institution: fields.institution ?? debt.institution,
    remaining_amount_cents: fields.remainingAmountCents ?? debt.remaining_amount_cents,
    rate_monthly: fields.rateMonthly ?? debt.rate_monthly,
    installments_paid: fields.installmentsPaid ?? debt.installments_paid,
    installment_amount_cents: fields.installmentAmountCents ?? debt.installment_amount_cents,
    due_day: fields.dueDay ?? debt.due_day
  };

  await db.prepare(
    `UPDATE debts SET name = ?, institution = ?, remaining_amount_cents = ?, rate_monthly = ?,
       installments_paid = ?, installment_amount_cents = ?, due_day = ? WHERE id = ?`
  ).bind(
    merged.name, merged.institution, merged.remaining_amount_cents, merged.rate_monthly,
    merged.installments_paid, merged.installment_amount_cents, merged.due_day, id
  ).run();

  return { ...debt, ...merged };
}

export async function archiveDebt(db, userId, id) {
  const result = await db.prepare('UPDATE debts SET archived = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0;
}

// Registra um pagamento (normal ou extra/antecipado) e já atualiza o saldo
// devedor e o contador de parcelas pagas na mesma operação — evita a dívida
// e o histórico de pagamentos divergirem (mesmo padrão usado em goals.js).
export async function recordDebtPayment(db, userId, debtId, { amountCents, principalCents, interestCents, paidDate, isExtra }) {
  const debt = await db.prepare('SELECT * FROM debts WHERE id = ? AND user_id = ? AND archived = 0').bind(debtId, userId).first();
  if (!debt) return null;

  const paymentId = crypto.randomUUID();
  const newRemaining = Math.max(debt.remaining_amount_cents - principalCents, 0);
  const newInstallmentsPaid = isExtra ? debt.installments_paid : Math.min(debt.installments_paid + 1, debt.installments_total);

  await db.batch([
    db.prepare(
      'INSERT INTO debt_payments (id, debt_id, amount_cents, principal_cents, interest_cents, paid_date, is_extra) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(paymentId, debtId, amountCents, principalCents, interestCents || 0, paidDate, isExtra ? 1 : 0),
    db.prepare('UPDATE debts SET remaining_amount_cents = ?, installments_paid = ? WHERE id = ?')
      .bind(newRemaining, newInstallmentsPaid, debtId)
  ]);

  return { ...debt, remaining_amount_cents: newRemaining, installments_paid: newInstallmentsPaid };
}

export async function listDebtPayments(db, debtId) {
  const { results } = await db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY paid_date DESC').bind(debtId).all();
  return results;
}
