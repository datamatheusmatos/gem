import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreak, calculateComplianceRate } from '../../src/engine/habitsCalc.js';

test('streak para na primeira quebra ao contar do dia mais recente', () => {
  const logs = [
    { date: '2026-08-24', done: true }, { date: '2026-08-25', done: true },
    { date: '2026-08-26', done: true }, { date: '2026-08-27', done: false },
    { date: '2026-08-28', done: true }
  ];
  assert.equal(calculateStreak(logs), 1);
});

test('streak conta sequência completa quando não há quebra', () => {
  const logs = [
    { date: '2026-08-26', done: true }, { date: '2026-08-27', done: true }, { date: '2026-08-28', done: true }
  ];
  assert.equal(calculateStreak(logs), 3);
});

test('taxa de cumprimento diária', () => {
  const logs = [
    { date: '2026-08-24', done: true }, { date: '2026-08-25', done: true },
    { date: '2026-08-26', done: true }, { date: '2026-08-27', done: false },
    { date: '2026-08-28', done: true }
  ];
  assert.equal(calculateComplianceRate(logs, { periodDays: 5, frequency: 'diario' }), 80);
});

test('taxa de cumprimento nunca ultrapassa 100%', () => {
  const logs = Array.from({ length: 10 }, (_, i) => ({ date: `2026-08-${10 + i}`, done: true }));
  assert.equal(calculateComplianceRate(logs, { periodDays: 5, frequency: 'diario' }), 100);
});
