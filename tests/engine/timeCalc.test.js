import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyPlan, detectAppointmentConflicts, calculateTaskPriorityScore, classifyEisenhower
} from '../../src/engine/timeCalc.js';

test('planejamento impossível é sinalizado como over-committed (seção 74)', () => {
  const tasks = [
    { effort_minutes: 8 * 60 }, { effort_minutes: 2 * 60 }, { effort_minutes: 3 * 60 },
    { effort_minutes: 2 * 60 }, { effort_minutes: 2 * 60 }, { effort_minutes: 2 * 60 }
  ];
  const plan = calculateDailyPlan({ appointments: [], tasks, sleepMinutes: 8 * 60 });

  assert.equal(plan.waking_minutes, 960);
  assert.equal(plan.committed_minutes, 1140);
  assert.equal(plan.available_minutes, -180);
  assert.equal(plan.is_over_committed, true);
});

test('planejamento que cabe no dia não é sinalizado', () => {
  const tasks = [{ effort_minutes: 4 * 60 }];
  const plan = calculateDailyPlan({ appointments: [], tasks, sleepMinutes: 8 * 60 });
  assert.equal(plan.is_over_committed, false);
});

test('detecta compromissos sobrepostos', () => {
  const conflicts = detectAppointmentConflicts([
    { id: 'a', start_at: '2026-08-28T19:00:00Z', end_at: '2026-08-28T20:00:00Z' },
    { id: 'b', start_at: '2026-08-28T19:30:00Z', end_at: '2026-08-28T21:00:00Z' }
  ]);
  assert.equal(conflicts.length, 1);
});

test('não acusa conflito quando compromissos não se sobrepõem', () => {
  const conflicts = detectAppointmentConflicts([
    { id: 'a', start_at: '2026-08-28T09:00:00Z', end_at: '2026-08-28T10:00:00Z' },
    { id: 'b', start_at: '2026-08-28T10:00:00Z', end_at: '2026-08-28T11:00:00Z' }
  ]);
  assert.equal(conflicts.length, 0);
});

test('tarefa importante e urgente cai em fazer_agora', () => {
  assert.equal(classifyEisenhower({ importance: 5, urgency: 5 }), 'fazer_agora');
});

test('score de prioridade aumenta quanto mais perto o prazo', () => {
  const today = new Date('2026-08-28');
  const longe = calculateTaskPriorityScore({ importance: 3, urgency: 3, due_date: '2026-09-28' }, today);
  const perto = calculateTaskPriorityScore({ importance: 3, urgency: 3, due_date: '2026-08-29' }, today);
  assert.ok(perto > longe);
});
