import { jsonError, jsonOk } from '../shared/http.js';
import { toCents, fromCents } from '../shared/money.js';
import { validateEnum, validateRange } from '../shared/validation.js';
import { getUserSettings, updateUserSettings } from '../db/userSettings.js';

export async function handleSettings(request, env) {
  const db = env.DB;
  const userId = request.user.id;

  if (request.method === 'GET') {
    const settings = await getUserSettings(db, userId);
    if (!settings) return jsonError('Configurações não encontradas.', 404);
    return jsonOk({ settings: serialize(settings) });
  }

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');

    const themeError = validateEnum(body.theme, ['light', 'dark', 'system'], 'Tema');
    if (themeError) return jsonError(themeError);
    const weekStartError = validateEnum(body.weekStart, ['monday', 'sunday'], 'Início da semana');
    if (weekStartError) return jsonError(weekStartError);
    if (body.emergencyFundTargetMonths !== undefined) {
      const monthsError = validateRange(body.emergencyFundTargetMonths, 1, 24, 'Meta de reserva (meses)');
      if (monthsError) return jsonError(monthsError);
    }
    if (body.currency !== undefined) {
      // Não tentamos validar contra a lista completa de códigos ISO 4217 (são
      // ~180) — mas exigimos o formato correto (3 letras maiúsculas), que é
      // o mínimo para não quebrar `Intl.NumberFormat` no frontend, que exige
      // exatamente esse formato mesmo que o código não exista de verdade.
      if (typeof body.currency !== 'string' || !/^[A-Z]{3}$/.test(body.currency)) {
        return jsonError('Moeda inválida — use um código de 3 letras (ex.: BRL, USD, EUR).');
      }
    }

    const safetyMarginCents = body.safetyMargin !== undefined ? toCents(body.safetyMargin) : undefined;
    if (body.safetyMargin !== undefined && (safetyMarginCents === null || safetyMarginCents < 0)) {
      return jsonError('Margem de segurança inválida.');
    }

    const settings = await updateUserSettings(db, userId, {
      currency: body.currency,
      weekStart: body.weekStart,
      theme: body.theme,
      safetyMarginCents,
      emergencyFundTargetMonths: body.emergencyFundTargetMonths,
      onboardingCompleted: body.onboardingCompleted
    });
    if (!settings) return jsonError('Configurações não encontradas.', 404);
    return jsonOk({ settings: serialize(settings) });
  }

  return jsonError('Método não suportado.', 405);
}

function serialize(s) {
  return {
    currency: s.currency, weekStart: s.week_start, theme: s.theme,
    safetyMargin: fromCents(s.safety_margin_cents), emergencyFundTargetMonths: s.emergency_fund_target_months,
    onboardingCompleted: !!s.onboarding_completed
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
