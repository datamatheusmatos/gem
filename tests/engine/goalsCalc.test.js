import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGoalPlan } from '../../src/engine/goalsCalc.js';

test('meta atrasada calcula aumento de contribuição necessário (exemplo da seção 15)', () => {
  const goal = {
    name: 'Viagem',
    target_amount_cents: 600000,
    current_amount_cents: 120000,
    deadline: '2027-02-28',
    monthly_contribution_cents: 50000
  };
  const plan = calculateGoalPlan(goal, '2026-08-28');

  assert.equal(plan.applicable, true);
  assert.equal(plan.months_left, 6);
  assert.equal(plan.required_monthly_cents, 80000);
  assert.equal(plan.is_behind_schedule, true);
  assert.equal(plan.required_increase_cents, 30000);
});

test('meta no ritmo certo não aponta atraso', () => {
  const goal = {
    target_amount_cents: 120000,
    current_amount_cents: 0,
    deadline: '2026-12-28', // 4 meses à frente de 2026-08-28
    monthly_contribution_cents: 30000 // exatamente 120000/4
  };
  const plan = calculateGoalPlan(goal, '2026-08-28');
  assert.equal(plan.is_behind_schedule, false);
});

test('meta sem prazo/valor-alvo retorna applicable=false (meta geral, seção 50)', () => {
  const goal = { target_amount_cents: null, deadline: null };
  const plan = calculateGoalPlan(goal);
  assert.equal(plan.applicable, false);
});

test('meta atrasada sem nenhuma contribuição ainda é sinalizada', () => {
  const goal = {
    target_amount_cents: 100000,
    current_amount_cents: 0,
    deadline: '2026-09-28',
    monthly_contribution_cents: 0
  };
  const plan = calculateGoalPlan(goal, '2026-08-28');
  assert.equal(plan.is_behind_schedule, true);
});
