// Seção 25: sequência, frequência, consistência, taxa de cumprimento.

// `logs` deve vir ordenado por data ASC, cada um { date, done }.
export function calculateStreak(logs) {
  const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  let expectedDate = null;

  for (const log of sorted) {
    if (!log.done) break;
    const logDate = new Date(log.date);
    if (expectedDate === null) {
      streak = 1;
      expectedDate = logDate;
    } else {
      const diffDays = Math.round((expectedDate - logDate) / 86400000);
      if (diffDays === 1) {
        streak++;
        expectedDate = logDate;
      } else {
        break;
      }
    }
  }
  return streak;
}

// Taxa de cumprimento no período: quantos dias esperados (conforme a frequência)
// foram de fato marcados como concluídos.
export function calculateComplianceRate(logs, { periodDays, frequency }) {
  const expectedOccurrences = frequency === 'diario'
    ? periodDays
    : frequency === 'semanal'
      ? Math.ceil(periodDays / 7)
      : Math.ceil(periodDays / 30);

  const doneCount = logs.filter(l => l.done).length;
  if (expectedOccurrences === 0) return 0;
  return Math.min(Math.round((doneCount / expectedOccurrences) * 100), 100);
}
