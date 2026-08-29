import { jsonError, jsonOk } from '../shared/http.js';
import { validateDateFormat, validateRange, sanitizeText, validateMaxLength } from '../shared/validation.js';
import * as Exercises from '../db/exercises.js';
import * as WorkoutSessions from '../db/workoutSessions.js';
import { getEnergyLogForDate } from '../db/energyLogs.js';
import { calculateDailyPlan } from '../engine/timeCalc.js';
import { listTasksDueOn } from '../db/tasks.js';
import { listAppointmentsInRange } from '../db/appointments.js';
import {
  chooseMuscleGroup, computeIntensity, selectExercises, calculateProgression, muscleGroupLabel
} from '../engine/workoutCalc.js';

const DIFFICULTY_ORDER = ['iniciante', 'intermediario', 'avancado'];

export async function handleWorkouts(request, env, segments) {
  const action = segments[0];
  const db = env.DB;
  const userId = request.user.id;
  const url = new URL(request.url);

  if (action === 'suggestion' && request.method === 'GET') {
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const dateError = validateDateFormat(date, 'Data');
    if (dateError) return jsonError(dateError);
    return suggestionRoute(db, userId, date);
  }

  if (action === 'sessions' && request.method === 'GET') {
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!start || !end) return jsonError('Informe o intervalo (start e end).');
    const startError = validateDateFormat(start, 'Data inicial');
    if (startError) return jsonError(startError);
    const endError = validateDateFormat(end, 'Data final');
    if (endError) return jsonError(endError);

    const sessions = await WorkoutSessions.listSessionsInRange(db, userId, { start, end });
    const withExercises = await Promise.all(sessions.map(async s => ({
      ...s, exercises: await WorkoutSessions.getSessionExercises(db, s.id)
    })));
    return jsonOk({ sessions: withExercises });
  }

  if (action === 'sessions' && request.method === 'POST') {
    return createSessionRoute(request, db, userId);
  }

  if (action === 'sessions' && segments[1] && request.method === 'DELETE') {
    const ok = await WorkoutSessions.deleteSession(db, userId, segments[1]);
    if (!ok) return jsonError('Sessão de treino não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  if (action === 'exercises' && request.method === 'GET') {
    const exercises = await Exercises.listAllExercises(db);
    return jsonOk({ exercises });
  }

  if (action === 'excluded-exercises' && request.method === 'GET') {
    const excluded = await Exercises.listExcludedWithDetails(db, userId);
    return jsonOk({ excluded });
  }

  if (action === 'excluded-exercises' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body || !body.exerciseId) return jsonError('Informe o exercício a excluir.');
    const reasonError = body.reason ? validateMaxLength(body.reason, 200, 'Motivo') : null;
    if (reasonError) return jsonError(reasonError);

    await Exercises.excludeExercise(db, userId, body.exerciseId, body.reason ? sanitizeText(body.reason, { maxLength: 200 }) : null);
    return jsonOk({ ok: true }, 201);
  }

  if (action === 'excluded-exercises' && segments[1] && request.method === 'DELETE') {
    const ok = await Exercises.unexcludeExercise(db, userId, segments[1]);
    if (!ok) return jsonError('Exclusão não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Rota de treino não encontrada.', 404);
}

// ---------- Sugestão do dia ----------

async function suggestionRoute(db, userId, date) {
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const [appointments, tasks, recentSessions, energyLog, excludedIds] = await Promise.all([
    listAppointmentsInRange(db, userId, { start: dayStart, end: dayEnd }),
    listTasksDueOn(db, userId, date),
    WorkoutSessions.listRecentSessions(db, userId, 5),
    getEnergyLogForDate(db, userId, date),
    Exercises.listExcludedIds(db, userId)
  ]);

  const plan = calculateDailyPlan({ appointments, tasks });
  const availableMinutes = Math.max(Math.round(plan.available_minutes), 0);

  const { group, reason: groupReason } = chooseMuscleGroup(recentSessions);
  const intensity = computeIntensity(availableMinutes, energyLog?.energy ?? null);

  if (!intensity.applicable) {
    return jsonOk({
      applicable: false,
      reason: 'Tempo disponível hoje é curto demais para um treino completo (menos de 10 minutos livres).',
      availableMinutes
    });
  }

  const library = (await Exercises.listExercisesByGroup(db, group)).filter(e => !excludedIds.includes(e.id));

  const sinceDate = new Date(date);
  sinceDate.setDate(sinceDate.getDate() - 21);
  const recentLogs = await WorkoutSessions.listRecentExerciseLogs(db, userId, sinceDate.toISOString().slice(0, 10));
  const progression = calculateProgression(recentLogs);

  const exercises = selectExercises(library, { ...intensity, difficultyOrder: DIFFICULTY_ORDER }, progression);

  return jsonOk({
    applicable: true,
    date,
    muscleGroup: group,
    muscleGroupLabel: muscleGroupLabel(group),
    availableMinutes,
    targetMinutes: intensity.targetMinutes,
    intensityLabel: intensity.intensityLabel,
    explanation: [groupReason, `Duração alvo: ${intensity.targetMinutes} min (${intensity.intensityLabel}, a partir de ${availableMinutes} min disponíveis hoje).`],
    exercises
  });
}

// ---------- Registrar sessão ----------

async function createSessionRoute(request, db, userId) {
  const body = await readJson(request);
  if (!body || !body.date || !body.muscleGroups || !Array.isArray(body.exercises)) {
    return jsonError('Informe data, grupo(s) muscular(es) e a lista de exercícios realizados.');
  }
  const dateError = validateDateFormat(body.date, 'Data');
  if (dateError) return jsonError(dateError);

  if (body.perceivedEffort !== undefined) {
    const effortError = validateRange(body.perceivedEffort, 1, 5, 'Esforço percebido');
    if (effortError) return jsonError(effortError);
  }
  if (body.exercises.length === 0) return jsonError('Informe ao menos um exercício realizado.');

  for (const ex of body.exercises) {
    if (!ex.exerciseId || !ex.sets || !ex.reps || ex.sets <= 0 || ex.reps <= 0) {
      return jsonError('Cada exercício precisa de exerciseId, sets e reps maiores que zero.');
    }
  }

  const result = await WorkoutSessions.createSession(db, userId, {
    date: body.date,
    muscleGroups: Array.isArray(body.muscleGroups) ? body.muscleGroups.join(',') : body.muscleGroups,
    durationMinutes: body.durationMinutes || null,
    perceivedEffort: body.perceivedEffort || null,
    exercises: body.exercises
  });

  return jsonOk({ session: result }, 201);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
