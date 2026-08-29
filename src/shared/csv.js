// Conversor simples de linhas (arrays de objetos, formato retornado pelo D1)
// para CSV. Genérico o suficiente para qualquer tabela do backup, sem
// precisar de uma função por recurso.

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const header = columns.map(csvEscape).join(',');
  const lines = rows.map(row => columns.map(col => csvEscape(row[col])).join(','));
  return [header, ...lines].join('\n');
}
