// Funções puras — sem banco — cobrindo as seções 20 e 21 da especificação.

// Indicadores gerais de foco (seção 20): horas de foco, número de sessões,
// duração média, produtividade percebida média.
export function calculateFocusStats(sessions) {
  if (sessions.length === 0) {
    return { total_minutes: 0, session_count: 0, avg_minutes: 0, avg_productivity: null };
  }
  const totalMinutes = sessions.reduce((s, f) => s + f.duration_minutes, 0);
  const withProductivity = sessions.filter(f => f.perceived_productivity != null);
  const avgProductivity = withProductivity.length
    ? withProductivity.reduce((s, f) => s + f.perceived_productivity, 0) / withProductivity.length
    : null;

  return {
    total_minutes: totalMinutes,
    session_count: sessions.length,
    avg_minutes: Math.round(totalMinutes / sessions.length),
    avg_productivity: avgProductivity !== null ? Math.round(avgProductivity * 10) / 10 : null
  };
}

// "Seu melhor desempenho ocorre em sessões entre 45 e 70 minutos" (seção 27):
// agrupa sessões em faixas de duração e compara produtividade média percebida.
// Exige um mínimo de amostras por faixa para não tirar conclusão de 1-2 sessões.
const DURATION_BUCKETS = [
  { label: 'até 45 min', min: 0, max: 45 },
  { label: '45–90 min', min: 45, max: 90 },
  { label: 'acima de 90 min', min: 90, max: Infinity }
];

export function analyzeDurationVsProductivity(sessions, { minSamplesPerBucket = 3 } = {}) {
  const buckets = DURATION_BUCKETS.map(b => ({ ...b, sessions: [] }));

  for (const s of sessions) {
    if (s.perceived_productivity == null) continue;
    const bucket = buckets.find(b => s.duration_minutes > b.min && s.duration_minutes <= b.max);
    if (bucket) bucket.sessions.push(s.perceived_productivity);
  }

  const results = buckets
    .filter(b => b.sessions.length >= minSamplesPerBucket)
    .map(b => ({
      label: b.label,
      sample_size: b.sessions.length,
      avg_productivity: Math.round((b.sessions.reduce((s, v) => s + v, 0) / b.sessions.length) * 10) / 10
    }));

  return { has_enough_data: results.length >= 2, buckets: results };
}

// Melhor horário do dia para foco, a partir da hora de início da sessão.
export function analyzeBestHours(sessions, { minSamplesPerHour = 2 } = {}) {
  const byHour = {};
  for (const s of sessions) {
    if (s.perceived_productivity == null) continue;
    const hour = new Date(s.started_at).getUTCHours();
    if (!byHour[hour]) byHour[hour] = [];
    byHour[hour].push(s.perceived_productivity);
  }

  const results = Object.entries(byHour)
    .filter(([, values]) => values.length >= minSamplesPerHour)
    .map(([hour, values]) => ({
      hour: parseInt(hour, 10),
      sample_size: values.length,
      avg_productivity: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
    }))
    .sort((a, b) => b.avg_productivity - a.avg_productivity);

  return { has_enough_data: results.length >= 2, hours: results };
}

// Padrão de energia por dia da semana (seção 21). Nota: o registro de energia
// é diário, não por período do dia — então o sistema consegue dizer "suas
// terças costumam ter energia mais baixa", mas não "suas noites de terça",
// que exigiria um segundo registro por período. Documentado como limitação.
const WEEKDAY_LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function analyzeWeekdayEnergyPattern(energyLogs, { minSamplesPerWeekday = 2 } = {}) {
  const byWeekday = {};
  for (const log of energyLogs) {
    if (log.energy == null) continue;
    const weekday = new Date(log.date).getUTCDay();
    if (!byWeekday[weekday]) byWeekday[weekday] = [];
    byWeekday[weekday].push(log.energy);
  }

  const results = Object.entries(byWeekday)
    .filter(([, values]) => values.length >= minSamplesPerWeekday)
    .map(([weekday, values]) => ({
      weekday: WEEKDAY_LABELS[parseInt(weekday, 10)],
      sample_size: values.length,
      avg_energy: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
    }))
    .sort((a, b) => a.avg_energy - b.avg_energy);

  return { has_enough_data: results.length >= 3, weekdays: results };
}
