// Seção 22: "Você está X% abaixo do ritmo necessário para concluir até dezembro."

function weeksBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  return Math.max((to - from) / (1000 * 60 * 60 * 24 * 7), 0.01); // evita divisão por zero
}

export function calculateStudyPace(item, recentSessions, today = new Date().toISOString().slice(0, 10)) {
  if (!item.total_hours || !item.deadline) {
    return { applicable: false };
  }

  const hoursRemaining = Math.max(item.total_hours - item.hours_done, 0);
  const weeksLeft = weeksBetween(today, item.deadline);
  const requiredWeeklyHours = hoursRemaining / weeksLeft;

  // ritmo atual = média semanal das últimas sessões (janela informada pelo chamador)
  const recentHours = recentSessions.reduce((s, sess) => s + sess.minutes, 0) / 60;
  const recentWeeks = recentSessions.length > 0
    ? weeksBetween(recentSessions[0].date, today) || 1
    : 1;
  const actualWeeklyHours = recentHours / recentWeeks;

  const percentBehind = requiredWeeklyHours > 0
    ? Math.round(((requiredWeeklyHours - actualWeeklyHours) / requiredWeeklyHours) * 100)
    : 0;

  return {
    applicable: true,
    hours_remaining: Math.round(hoursRemaining * 10) / 10,
    required_weekly_hours: Math.round(requiredWeeklyHours * 10) / 10,
    actual_weekly_hours: Math.round(actualWeeklyHours * 10) / 10,
    percent_behind: percentBehind, // negativo = à frente do ritmo
    is_behind: percentBehind > 0
  };
}
