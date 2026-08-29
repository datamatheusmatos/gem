// Todo valor monetário é armazenado em centavos (INTEGER) para evitar erro de
// ponto flutuante. Esta é a única porta de entrada/saída entre "reais" (o que o
// usuário digita/vê) e "centavos" (o que o banco guarda).

export function toCents(value) {
  const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (typeof n !== 'number' || Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function fromCents(cents) {
  return Math.round(cents) / 100;
}
