import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validateRequiredFields, validateRange, validatePositive, validateMaxLength, validateDateFormat } from '../shared/validation.js';
import * as TimeEntries from '../db/timeEntries.js';
import * as Tasks from '../db/tasks.js';
import * as Appointments from '../db/appointments.js';
import {
  calculateDailyPlan, detectAppointmentConflicts,
  calculateTaskPriorityScore, classifyEisenhower, summarizeTimeByCategory
} from '../engine/timeCalc.js';

export async function handleTime(request, env, segments) {
  const resource = segments[0]; // entries | tasks | appointments | today
  const id = segments[1];
  const db = env.DB;
  const userId = request.user.id;

  if (resource === 'entries') return entriesRoute(request, db, userId, id);
  if (resource === 'tasks') return tasksRoute(request, db, userId, id);
  if (resource === 'appointments') return appointmentsRoute(request, db, userId, id);
  if (resource === 'today') return todayRoute(request, db, userId);

  return jsonError('Rota de gestão de tempo não encontrada.', 404);
}

// ---------- Registros de tempo ----------

async function entriesRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!start || !end) return jsonError('Informe o intervalo (start e end).');
    const startError = validateDateFormat(start, 'Data inicial');
    if (startError) return jsonError(startError);
    const endError = validateDateFormat(end, 'Data final');
    if (endError) return jsonError(endError);

    const entries = await TimeEntries.listTimeEntriesInRange(db, userId, { start, end });
    return jsonOk({ entries, byCategory: summarizeTimeByCategory(entries) });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    const errors = validateRequiredFields(body, ['category', 'minutes', 'date']);
    if (errors) return jsonError('Preencha os campos obrigatórios.');
    if (body.minutes <= 0) return jsonError('Duração inválida.');

    const entry = await TimeEntries.createTimeEntry(db, userId, {
      category: body.category,
      minutes: body.minutes,
      date: body.date,
      notes: body.notes ? sanitizeText(body.notes, { maxLength: 500 }) : null
    });
    return jsonOk({ entry }, 201);
  }

  if (request.method === 'DELETE') {
    if (!id) return jsonError('Informe o id do registro.', 400);
    const ok = await TimeEntries.deleteTimeEntry(db, userId, id);
    if (!ok) return jsonError('Registro não encontrado.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- Tarefas ----------

async function tasksRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const tasks = await Tasks.listOpenTasks(db, userId);
    const withScore = tasks.map(t => ({
      ...t,
      priorityScore: calculateTaskPriorityScore(t),
      eisenhower: classifyEisenhower(t)
    })).sort((a, b) => b.priorityScore - a.priorityScore);
    return jsonOk({ tasks: withScore });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    const errors = validateRequiredFields(body, ['title']);
    if (errors) return jsonError('Informe o título da tarefa.');

    const titleError = validateMaxLength(body.title, 200, 'Título da tarefa');
    if (titleError) return jsonError(titleError);

    const importanceError = validateRange(body.importance, 1, 5, 'Importância');
    if (importanceError) return jsonError(importanceError);
    const urgencyError = validateRange(body.urgency, 1, 5, 'Urgência');
    if (urgencyError) return jsonError(urgencyError);
    const effortError = validatePositive(body.effortMinutes, 'Esforço estimado (minutos)');
    if (effortError) return jsonError(effortError);

    const task = await Tasks.createTask(db, userId, {
      title: sanitizeText(body.title, { maxLength: 200 }),
      importance: body.importance,
      urgency: body.urgency,
      effortMinutes: body.effortMinutes,
      dueDate: body.dueDate,
      projectId: body.projectId
    });
    return jsonOk({ task }, 201);
  }

  if (!id) return jsonError('Informe o id da tarefa.', 400);

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    const fields = {};
    if (body.title !== undefined) fields.title = sanitizeText(body.title, { maxLength: 200 });
    if (body.importance !== undefined) {
      const importanceError = validateRange(body.importance, 1, 5, 'Importância');
      if (importanceError) return jsonError(importanceError);
      fields.importance = body.importance;
    }
    if (body.urgency !== undefined) {
      const urgencyError = validateRange(body.urgency, 1, 5, 'Urgência');
      if (urgencyError) return jsonError(urgencyError);
      fields.urgency = body.urgency;
    }
    if (body.effortMinutes !== undefined) {
      const effortError = validatePositive(body.effortMinutes, 'Esforço estimado (minutos)');
      if (effortError) return jsonError(effortError);
      fields.effortMinutes = body.effortMinutes;
    }
    if (body.dueDate !== undefined) fields.dueDate = body.dueDate;
    if (body.done !== undefined) fields.done = body.done;

    const task = await Tasks.updateTask(db, userId, id, fields);
    if (!task) return jsonError('Tarefa não encontrada.', 404);
    return jsonOk({ task });
  }

  if (request.method === 'DELETE') {
    const ok = await Tasks.deleteTask(db, userId, id);
    if (!ok) return jsonError('Tarefa não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- Agenda ----------

async function appointmentsRoute(request, db, userId, id) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    if (!start || !end) return jsonError('Informe o intervalo (start e end).');

    const appointments = await Appointments.listAppointmentsInRange(db, userId, { start, end });
    const conflicts = detectAppointmentConflicts(appointments);
    return jsonOk({ appointments, conflicts });
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    if (!body) return jsonError('Corpo da requisição inválido.');
    const errors = validateRequiredFields(body, ['title', 'startAt', 'endAt']);
    if (errors) return jsonError('Preencha os campos obrigatórios.');
    if (new Date(body.endAt) <= new Date(body.startAt)) return jsonError('O horário final precisa ser depois do inicial.');

    const appointment = await Appointments.createAppointment(db, userId, {
      title: sanitizeText(body.title, { maxLength: 200 }),
      startAt: body.startAt,
      endAt: body.endAt,
      location: body.location ? sanitizeText(body.location, { maxLength: 200 }) : null
    });
    return jsonOk({ appointment }, 201);
  }

  if (request.method === 'DELETE') {
    if (!id) return jsonError('Informe o id do compromisso.', 400);
    const ok = await Appointments.deleteAppointment(db, userId, id);
    if (!ok) return jsonError('Compromisso não encontrado.', 404);
    return jsonOk({ ok: true });
  }

  return jsonError('Método não suportado.', 405);
}

// ---------- "Meu Dia" ----------

async function todayRoute(request, db, userId) {
  if (request.method !== 'GET') return jsonError('Método não suportado.', 405);

  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const dateError = validateDateFormat(date, 'Data');
  if (dateError) return jsonError(dateError);

  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  const [appointments, tasks] = await Promise.all([
    Appointments.listAppointmentsInRange(db, userId, { start: dayStart, end: dayEnd }),
    Tasks.listTasksDueOn(db, userId, date)
  ]);

  const tasksWithScore = tasks.map(t => ({
    ...t,
    priorityScore: calculateTaskPriorityScore(t, new Date(date)),
    eisenhower: classifyEisenhower(t)
  })).sort((a, b) => b.priorityScore - a.priorityScore);

  const plan = calculateDailyPlan({ appointments, tasks });
  const conflicts = detectAppointmentConflicts(appointments);

  return jsonOk({
    date,
    appointments,
    tasks: tasksWithScore,
    plan,
    conflicts
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
