// Funções puras — sem banco — para poder testar a matemática isoladamente
// antes de ligar às rotas. Cobre seções 18, 19, 23, 56 e 74 da especificação.

// Minutos de vigília assumidos por padrão (24h - 8h de sono), usado quando não
// há registro de sono no dia. Documentado explicitamente: é uma estimativa
// razoável, não um dado que o usuário informou.
export const DEFAULT_WAKING_MINUTES = 16 * 60;

function toMinutes(isoStart, isoEnd) {
  return Math.max(Math.round((new Date(isoEnd) - new Date(isoStart)) / 60000), 0);
}

// "Meu Dia" (seção 19): calcula quanto tempo realmente sobra depois de
// compromissos com horário fixo e tarefas com esforço estimado. Nunca deixa o
// planejamento "parecer" caber quando não cabe (seção 74) — sinaliza overCommitted.
export function calculateDailyPlan({ appointments, tasks, sleepMinutes }) {
  const wakingMinutes = sleepMinutes ? (24 * 60 - sleepMinutes) : DEFAULT_WAKING_MINUTES;

  const appointmentsMinutes = appointments.reduce((sum, a) => sum + toMinutes(a.start_at, a.end_at), 0);
  const tasksMinutes = tasks.reduce((sum, t) => sum + (t.effort_minutes || 0), 0);

  const committedMinutes = appointmentsMinutes + tasksMinutes;
  const availableMinutes = wakingMinutes - committedMinutes;

  return {
    waking_minutes: wakingMinutes,
    committed_minutes: committedMinutes,
    available_minutes: availableMinutes,
    is_over_committed: availableMinutes < 0
  };
}

// Detecta compromissos que se sobrepõem no tempo (seção 55).
export function detectAppointmentConflicts(appointments) {
  const sorted = [...appointments].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const conflicts = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (new Date(next.start_at) < new Date(current.end_at)) {
      conflicts.push({ a: current.id, b: next.id });
    }
  }
  return conflicts;
}

// Pontuação de prioridade (seção 23): combina importância/urgência (Eisenhower)
// com proximidade do prazo (seção 56 — prioridade dinâmica). Score maior = mais
// prioritário. Escala arbitrária, mas consistente e explicável.
export function calculateTaskPriorityScore(task, today = new Date()) {
  const importance = task.importance || 3;
  const urgency = task.urgency || 3;
  let deadlineBoost = 0;

  if (task.due_date) {
    const daysLeft = Math.max(Math.round((new Date(task.due_date) - today) / 86400000), 0);
    // quanto mais perto do prazo, maior o boost — satura em 5 pontos
    deadlineBoost = Math.min(5, Math.max(0, 5 - daysLeft));
  }

  return importance * 2 + urgency * 2 + deadlineBoost;
}

export function classifyEisenhower(task) {
  const highImportance = (task.importance || 3) >= 4;
  const highUrgency = (task.urgency || 3) >= 4;
  if (highImportance && highUrgency) return 'fazer_agora';
  if (highImportance && !highUrgency) return 'planejar';
  if (!highImportance && highUrgency) return 'delegar_ou_agilizar';
  return 'eliminar_ou_adiar';
}

// "Para onde está indo meu tempo?" (seção 18): agrupa minutos registrados por
// categoria num intervalo, para o gráfico de distribuição semanal.
export function summarizeTimeByCategory(entries) {
  const totals = {};
  for (const e of entries) {
    totals[e.category] = (totals[e.category] || 0) + e.minutes;
  }
  return totals;
}
