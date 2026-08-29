// Soma N meses a uma data no formato 'YYYY-MM-DD', preservando o dia quando possível
// (cai para o último dia do mês de destino se o dia original não existir nele —
// ex.: 31/01 + 1 mês = 28/02 ou 29/02).
export function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  target.setUTCDate(day);
  return target.toISOString().slice(0, 10);
}

export function currentMonthRange(referenceDate = new Date()) {
  const y = referenceDate.getUTCFullYear();
  const m = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}
