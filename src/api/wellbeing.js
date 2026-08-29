import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validatePositive, validateNotFuture, validateInteger, validateRange } from '../shared/validation.js';
import * as FocusSessions from '../db/focusSessions.js';
import * as EnergyLogs from '../db/energyLogs.js';
import {
  calculateFocusStats, analyzeDurationVsProductivity, analyzeBestHours, analyzeWeekdayEnergyPattern
} from '../engine/focusCalc.js';

export async function handleWellbeing(request, env, segments) {
  const resource = segments[0]; // focus-sessions | energy-logs
  const id = segments[1];
  const db = env.DB;
  const userId = request.user.id;

  if (resource === 'focus-sessions') return focusSessionsRoute(request, db, userId, id);
  if (resource === 'energy-logs') return energyLogsRoute(request, db, userId);

  return jsonError('Rota de foco/energia não encontrada.', 404);
}

// ---------- Foco ----------

async function focusSessionsRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!start || !end) return jsonError('Informe o intervalo (start e end).');

    const sessions = await FocusSessions.listFocusSessionsInRange(db, userId, { start, end });
    return jsonOk({
      sessions,
      stats: calculateFocusStats(sessions),
      durationVsProductivity: analyzeDurationVsProductivity(sessions),
      bestHours: analyzeBestHours(sessions)
    });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body || !body.durationMinutes || !body.startedAt) {
      return jsonError('Informe duração e horário de início da sessão.');
    }
    const durationError = validatePositive(body.durationMinutes, 'Duração da sessão');
    if (durationError) return jsonError(durationError);
    const futureError = validateNotFuture(body.startedAt, 'Horário de início');
    if (futureError) return jsonError(futureError);
    if (body.perceivedProductivity !== undefined && (body.perceivedProductivity < 1 || body.perceivedProductivity > 5)) {
      return jsonError('Produtividade percebida deve ser de 1 a 5.');
    }

    const session = await FocusSessions.createFocusSession(db, userId, {
      projectId: body.projectId || null,
      objective: body.objective ? sanitizeText(body.objective, { maxLength: 200 }) : null,
      durationMinutes: body.durationMinutes,
      interruptions: body.interruptions || 0,
      perceivedProductivity: body.perceivedProductivity,
      startedAt: body.startedAt
    });
    return jsonOk({ session }, 201);
  }

  if (request.method === 'DELETE') {
    if (!id) return jsonError('Informe o id da sessão.', 400);
    const ok = await FocusSessions.deleteFocusSession(db, userId, id);
    if (!ok) return jsonError('Sessão não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- Energia/fadiga ----------

async function energyLogsRoute(request, db, userId) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!start || !end) return jsonError('Informe o intervalo (start e end).');

    const logs = await EnergyLogs.listEnergyLogsInRange(db, userId, { start, end });
    return jsonOk({ logs, weekdayPattern: analyzeWeekdayEnergyPattern(logs) });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body || !body.date) return jsonError('Informe a data do registro.');

    for (const field of ['energy', 'disposition', 'stress', 'sleepQuality', 'workload', 'concentration']) {
      if (body[field] === undefined) continue;
      const rangeError = validateRange(body[field], 1, 5, `Campo ${field}`);
      if (rangeError) return jsonError(rangeError);
      const integerError = validateInteger(body[field], `Campo ${field}`);
      if (integerError) return jsonError(integerError);
    }

    const log = await EnergyLogs.upsertEnergyLog(db, userId, body);
    return jsonOk({ log }, 201);
  }

  return jsonError('Método não suportado.', 405);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
