import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFocusStats, analyzeDurationVsProductivity } from '../../src/engine/focusCalc.js';

const sessions = [
  { duration_minutes: 30, perceived_productivity: 4, started_at: '2026-08-20T09:00:00Z' },
  { duration_minutes: 40, perceived_productivity: 5, started_at: '2026-08-21T09:30:00Z' },
  { duration_minutes: 35, perceived_productivity: 4, started_at: '2026-08-22T10:00:00Z' },
  { duration_minutes: 60, perceived_productivity: 5, started_at: '2026-08-20T15:00:00Z' },
  { duration_minutes: 70, perceived_productivity: 4, started_at: '2026-08-21T15:00:00Z' },
  { duration_minutes: 55, perceived_productivity: 5, started_at: '2026-08-22T15:00:00Z' },
  { duration_minutes: 120, perceived_productivity: 2, started_at: '2026-08-20T22:00:00Z' },
  { duration_minutes: 110, perceived_productivity: 2, started_at: '2026-08-21T22:00:00Z' },
  { duration_minutes: 130, perceived_productivity: 1, started_at: '2026-08-22T22:00:00Z' }
];

test('estatísticas gerais de foco somam corretamente', () => {
  const stats = calculateFocusStats(sessions);
  assert.equal(stats.session_count, 9);
  assert.equal(stats.total_minutes, 650);
});

test('sessões acima de 90min mostram produtividade menor (seção 27)', () => {
  const result = analyzeDurationVsProductivity(sessions);
  assert.equal(result.has_enough_data, true);

  const longas = result.buckets.find(b => b.label === 'acima de 90 min');
  const curtas = result.buckets.find(b => b.label === 'até 45 min');
  assert.ok(longas.avg_productivity < curtas.avg_productivity);
});

test('sem amostras suficientes, não afirma padrão nenhum', () => {
  const poucasSessoes = sessions.slice(0, 2);
  const result = analyzeDurationVsProductivity(poucasSessoes);
  assert.equal(result.has_enough_data, false);
});
