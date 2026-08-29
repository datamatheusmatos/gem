// Comparação percentual entre dois valores — usado para "seus gastos
// aumentaram X% em relação à semana/mês anterior" (seção 29 e 49).
export function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null; // não dá para expressar % de uma base zero
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

// Datas do início/fim de uma semana (segunda a domingo) contendo a data dada.
export function weekRange(dateStr) {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export function previousWeekRange(dateStr) {
  const { start } = weekRange(dateStr);
  const prevDate = new Date(start);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  return weekRange(prevDate.toISOString().slice(0, 10));
}

export function previousMonth(period) {
  const [year, month] = period.split('-').map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
}
