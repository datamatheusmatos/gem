// Validação e sanitização centralizadas — nenhuma rota deve validar "na mão".
// Retorna { valid: boolean, errors: { campo: mensagem } } para toda a API responder
// de forma consistente (seção 67: nenhuma operação falha silenciosamente).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return 'Informe um e-mail válido.';
  }
  return null;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }
  return null;
}

// Sanitização defensiva para qualquer texto livre que possa ser refletido em UI
// (notas, descrições, títulos). Remove tags e caracteres de controle — a
// renderização no frontend também deve escapar por padrão, isto é uma segunda camada.
export function sanitizeText(value, { maxLength = 2000 } = {}) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function validateRequiredFields(body, fields) {
  const errors = {};
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors[field] = 'Campo obrigatório.';
    }
  }
  return Object.keys(errors).length ? errors : null;
}

// Valida formato 'AAAA-MM' antes de qualquer cálculo de data — usado em todo
// endpoint que recebe mês/período como string (motor financeiro, orçamento,
// relatórios). Sem essa checagem, um formato inesperado (ex.: '08/2026')
// chega até `new Date(...)`/`.toISOString()` e derruba a rota com 500.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validateMonthFormat(month) {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) {
    return 'Formato de mês inválido. Use AAAA-MM (ex.: 2026-08).';
  }
  return null;
}

// Valida formato 'AAAA-MM-DD' e que a data é real (não "2026-13-45") —
// usado em qualquer endpoint que recebe uma data solta como string. Sem essa
// checagem, `new Date(...)` seguido de aritmética de data (`.getUTCDay()`,
// `.toISOString()`) pode produzir `Invalid Date` silenciosamente e derrubar a
// rota mais adiante com um erro técnico ("Invalid time value").
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDateFormat(dateStr, fieldLabel = 'Data') {
  if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) {
    return `${fieldLabel} em formato inválido. Use AAAA-MM-DD (ex.: 2026-08-29).`;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  // Se o mês/dia "estourar" (ex.: 2026-13-45), o JS normaliza para outra data
  // em vez de lançar erro — comparamos os componentes de volta para pegar isso.
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) {
    return `${fieldLabel} não é uma data válida.`;
  }
  return null;
}

// Valida que um valor está dentro de uma lista de opções permitidas —
// substitui a checagem que hoje só acontece via CHECK constraint do SQLite
// (que gera um erro técnico de banco em vez de uma mensagem clara ao usuário).
export function validateEnum(value, allowed, fieldLabel) {
  if (value === undefined || value === null) return null; // campo opcional, deixa passar
  if (!allowed.includes(value)) {
    return `${fieldLabel} inválido. Valores aceitos: ${allowed.join(', ')}.`;
  }
  return null;
}

// Valida que um valor está dentro de um intervalo numérico — substitui
// checagens de CHECK constraint (BETWEEN) do SQLite por mensagem clara.
export function validateRange(value, min, max, fieldLabel) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
    return `${fieldLabel} deve ser um número entre ${min} e ${max}.`;
  }
  return null;
}

// Valida tamanho máximo de texto ANTES de truncar — truncar silenciosamente
// (como sanitizeText fazia sozinho) perde dado do usuário sem aviso.
export function validateMaxLength(value, maxLength, fieldLabel) {
  if (typeof value !== 'string') return null;
  if (value.trim().length > maxLength) {
    return `${fieldLabel} excede o tamanho máximo de ${maxLength} caracteres.`;
  }
  return null;
}

// Valida que um número é estritamente positivo — usado em qualquer campo de
// duração/esforço em minutos, que nunca faz sentido como zero ou negativo.
export function validatePositive(value, fieldLabel) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return `${fieldLabel} precisa ser um número maior que zero.`;
  }
  return null;
}

// Valida que uma data/hora ISO não está no futuro — usado em registros que
// são inerentemente retrospectivos (sessão de foco/estudo já realizada).
// Aceita uma folga pequena (5 min) para relógios levemente dessincronizados
// entre cliente e servidor.
export function validateNotFuture(isoString, fieldLabel) {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return `${fieldLabel} inválida.`;
  if (date.getTime() > Date.now() + 5 * 60 * 1000) {
    return `${fieldLabel} não pode estar no futuro.`;
  }
  return null;
}

// Valida que um valor numérico é um inteiro — usado em escalas discretas
// (1 a 5) onde um decimal não faz sentido semântico, mesmo estando no range.
export function validateInteger(value, fieldLabel) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value)) {
    return `${fieldLabel} deve ser um número inteiro.`;
  }
  return null;
}

// Valida que um texto não é vazio/só espaços em branco DEPOIS do trim —
// `validateRequiredFields` só pega string vazia antes do trim, então
// "   " passa despercebido por ela.
export function validateNonBlank(value, fieldLabel) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return `${fieldLabel} não pode ficar em branco.`;
  }
  return null;
}
