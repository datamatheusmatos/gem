let currentCurrency = 'BRL';

// Chamado uma vez no carregamento do app (main.js), depois de buscar as
// configurações do usuário — é assim que o campo "Moeda" de Configurações
// deixa de ser decorativo e passa a valer para toda formatação monetária.
export function setCurrency(currency) {
  if (currency) currentCurrency = currency;
}

export function brl(value, currency) {
  const resolvedCurrency = currency ?? currentCurrency;
  try {
    return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: resolvedCurrency });
  } catch {
    // Intl.NumberFormat lança RangeError se `currency` não for um código
    // ISO 4217 válido — nunca deixamos isso quebrar a formatação de valores
    // monetários em nenhuma tela; caímos de volta para BRL.
    return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthISO() {
  return todayISO().slice(0, 7);
}

export function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

// Cria elementos DOM a partir de uma string HTML (usado para montar listas
// dinamicamente sem depender de nenhum framework).
export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
