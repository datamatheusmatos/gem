import { addMonths } from '../shared/dates.js';

// Cria uma transação. Se `installmentsTotal > 1`, gera automaticamente as parcelas
// futuras em `installments` (seção 7: uma compra de R$1.200 em 12x gera R$100/mês
// nos próximos 12 meses). O valor de cada parcela é arredondado para baixo e a
// diferença de arredondamento é jogada na última parcela, para a soma bater exato
// com o valor total da compra.
export async function createTransaction(db, userId, payload) {
  const {
    accountId, cardId, categoryId, description, amountCents, type,
    valueKind, dueDate, recurrence, installmentsTotal, notes
  } = payload;

  const id = crypto.randomUUID();
  const isInstallment = installmentsTotal && installmentsTotal > 1 ? 1 : 0;

  await db.prepare(
    `INSERT INTO transactions
      (id, user_id, account_id, card_id, category_id, description, amount_cents, type,
       value_kind, status, due_date, recurrence, is_installment, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?)`
  ).bind(
    id, userId, accountId || null, cardId || null, categoryId || null, description, amountCents, type,
    valueKind || 'real', dueDate, recurrence || null, isInstallment, notes || null
  ).run();

  if (isInstallment) {
    const perInstallment = Math.floor(amountCents / installmentsTotal);
    const remainder = amountCents - perInstallment * installmentsTotal;
    const statements = [];

    for (let n = 1; n <= installmentsTotal; n++) {
      const amount = n === installmentsTotal ? perInstallment + remainder : perInstallment;
      const dueDateForInstallment = addMonths(dueDate, n - 1);
      statements.push(
        db.prepare(
          'INSERT INTO installments (id, transaction_id, number, total, amount_cents, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), id, n, installmentsTotal, amount, dueDateForInstallment, 'previsto')
      );
    }
    await db.batch(statements);
  }

  return { id, is_installment: isInstallment };
}

// Lista ocorrências financeiras num intervalo de datas: transações avulsas +
// parcelas de transações parceladas, combinadas numa única linha do tempo.
export async function listTransactionsInRange(db, userId, { start, end }) {
  const { results } = await db.prepare(
    `SELECT
        t.id as transaction_id, t.description, t.category_id, t.card_id, t.account_id,
        t.type, t.value_kind, t.status, t.due_date, NULL as installment_number, NULL as installment_total,
        t.amount_cents
      FROM transactions t
      WHERE t.user_id = ? AND t.is_installment = 0 AND t.type != 'transferencia' AND t.due_date BETWEEN ? AND ?
      UNION ALL
      SELECT
        t.id as transaction_id, t.description, t.category_id, t.card_id, t.account_id,
        t.type, t.value_kind, i.status, i.due_date, i.number as installment_number, i.total as installment_total,
        i.amount_cents
      FROM installments i
      JOIN transactions t ON t.id = i.transaction_id
      WHERE t.user_id = ? AND t.is_installment = 1 AND i.due_date BETWEEN ? AND ?
      ORDER BY due_date`
  ).bind(userId, start, end, userId, start, end).all();
  return results;
}

export async function updateTransactionStatus(db, userId, transactionId, { status, installmentId }) {
  if (installmentId) {
    const result = await db.prepare(
      `UPDATE installments SET status = ?
       WHERE id = ? AND transaction_id IN (SELECT id FROM transactions WHERE id = ? AND user_id = ?)`
    ).bind(status, installmentId, transactionId, userId).run();
    return result.meta.changes > 0;
  }
  const result = await db.prepare('UPDATE transactions SET status = ? WHERE id = ? AND user_id = ?')
    .bind(status, transactionId, userId).run();
  return result.meta.changes > 0;
}

export async function deleteTransaction(db, userId, id) {
  const result = await db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return result.meta.changes > 0; // ON DELETE CASCADE remove as parcelas junto
}
