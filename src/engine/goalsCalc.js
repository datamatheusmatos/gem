// Cálculos de metas (seção 15): quanto guardar por mês/semana/dia, previsão de
// conclusão e quanto aumentar a contribuição se estiver atrasado. Funções puras
// para poder testar a matemática sem precisar de um banco.

function monthsBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  const dayAdjust = to.getUTCDate() < from.getUTCDate() ? -1 : 0;
  return Math.max(months + dayAdjust, 0);
}

function daysBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  return Math.max(Math.round((to - from) / (1000 * 60 * 60 * 24)), 0);
}

// Retorna quanto falta guardar por mês/semana/dia para bater a meta no prazo
// definido, e a data prevista de conclusão no ritmo atual de contribuição.
export function calculateGoalPlan(goal, today = new Date().toISOString().slice(0, 10)) {
  if (!goal.target_amount_cents || !goal.deadline) {
    return { applicable: false };
  }

  const remainingCents = Math.max(goal.target_amount_cents - goal.current_amount_cents, 0);
  const monthsLeft = monthsBetween(today, goal.deadline);
  const daysLeft = daysBetween(today, goal.deadline);

  const requiredMonthlyCents = monthsLeft > 0 ? Math.ceil(remainingCents / monthsLeft) : remainingCents;
  const requiredWeeklyCents = daysLeft > 0 ? Math.ceil(remainingCents / (daysLeft / 7)) : remainingCents;
  const requiredDailyCents = daysLeft > 0 ? Math.ceil(remainingCents / daysLeft) : remainingCents;

  const currentContribution = goal.monthly_contribution_cents || 0;
  let forecastMonths = null;
  let isBehindSchedule = remainingCents > 0 && currentContribution <= 0;

  if (currentContribution > 0 && remainingCents > 0) {
    forecastMonths = Math.ceil(remainingCents / currentContribution);
    isBehindSchedule = forecastMonths > monthsLeft;
  }

  const requiredIncreaseCents = isBehindSchedule && currentContribution > 0
    ? Math.max(requiredMonthlyCents - currentContribution, 0)
    : 0;

  return {
    applicable: true,
    remaining_cents: remainingCents,
    months_left: monthsLeft,
    required_monthly_cents: requiredMonthlyCents,
    required_weekly_cents: requiredWeeklyCents,
    required_daily_cents: requiredDailyCents,
    forecast_months: forecastMonths,
    is_behind_schedule: isBehindSchedule,
    required_increase_cents: requiredIncreaseCents
  };
}
