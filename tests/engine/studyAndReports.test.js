import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStudyPace } from '../../src/engine/studyCalc.js';
import { percentChange, weekRange, previousWeekRange, previousMonth } from '../../src/engine/reportsCalc.js';

test('detecta atraso de ritmo de estudo', () => {
  const item = { total_hours: 100, hours_done: 40, deadline: '2026-10-09' };
  const recentSessions = [{ minutes: 480, date: '2026-08-01' }];
  const pace = calculateStudyPace(item, recentSessions, '2026-08-28');
  assert.equal(pace.applicable, true);
  assert.equal(pace.is_behind, true);
  assert.ok(pace.percent_behind > 0);
});

test('item sem prazo/total de horas não é aplicável', () => {
  const pace = calculateStudyPace({ total_hours: null, deadline: null }, []);
  assert.equal(pace.applicable, false);
});

test('percentChange trata base zero sem lançar erro nem retornar Infinity', () => {
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(0, 0), 0);
  assert.equal(percentChange(180, 150), 20);
});

test('semana calculada como segunda a domingo', () => {
  const week = weekRange('2026-08-28'); // sexta-feira
  assert.equal(week.start, '2026-08-24');
  assert.equal(week.end, '2026-08-30');
});

test('semana anterior é contígua, sem sobreposição', () => {
  const prev = previousWeekRange('2026-08-28');
  assert.equal(prev.start, '2026-08-17');
  assert.equal(prev.end, '2026-08-23');
});

test('mês anterior trata virada de ano corretamente', () => {
  assert.equal(previousMonth('2026-01'), '2025-12');
  assert.equal(previousMonth('2026-08'), '2026-07');
});
