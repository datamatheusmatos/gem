import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCents, fromCents } from '../../src/shared/money.js';
import { addMonths, currentMonthRange } from '../../src/shared/dates.js';

test('toCents converte reais em centavos sem erro de ponto flutuante', () => {
  assert.equal(toCents('19,90'), 1990);
  assert.equal(toCents(1200), 120000);
  assert.equal(toCents('abc'), null);
});

test('fromCents é o inverso de toCents', () => {
  assert.equal(fromCents(120000), 1200);
  assert.equal(fromCents(1990), 19.9);
});

test('addMonths preserva o dia e cai para o último dia quando não existe no destino', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-08-15', 11), '2027-07-15');
});

test('currentMonthRange calcula início e fim do mês corretamente', () => {
  const range = currentMonthRange(new Date('2026-08-28T12:00:00Z'));
  assert.equal(range.start, '2026-08-01');
  assert.equal(range.end, '2026-08-31');
});

// Reproduz a lógica de divisão de parcelas de src/db/transactions.js (não
// importada diretamente por depender do binding D1) para garantir que a soma
// das parcelas sempre bate com o valor total da compra, mesmo com resto de
// divisão (seção 7).
function splitInstallments(amountCents, total) {
  const per = Math.floor(amountCents / total);
  const remainder = amountCents - per * total;
  const amounts = [];
  for (let n = 1; n <= total; n++) {
    amounts.push(n === total ? per + remainder : per);
  }
  return amounts;
}

test('parcelamento que divide exato soma o valor total', () => {
  const amounts = splitInstallments(120000, 12); // R$1.200 em 12x
  assert.equal(amounts.reduce((a, b) => a + b, 0), 120000);
  assert.ok(amounts.every(a => a === 10000));
});

test('parcelamento com resto de divisão ainda soma o valor total exato', () => {
  const amounts = splitInstallments(100000, 3); // R$1.000 em 3x
  assert.equal(amounts.reduce((a, b) => a + b, 0), 100000);
  assert.equal(amounts[0], 33333);
  assert.equal(amounts[2], 33334); // resto vai para a última parcela
});
