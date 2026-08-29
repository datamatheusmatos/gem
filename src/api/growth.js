import { jsonError, jsonOk } from '../shared/http.js';
import { sanitizeText, validateRequiredFields, validateRange, validateNotFuture } from '../shared/validation.js';
import { toCents } from '../shared/money.js';
import * as StudyItems from '../db/studyItems.js';
import * as Projects from '../db/projects.js';
import * as Habits from '../db/habits.js';
import * as Routines from '../db/routines.js';
import { calculateStudyPace } from '../engine/studyCalc.js';
import { calculateStreak, calculateComplianceRate } from '../engine/habitsCalc.js';

export async function handleGrowth(request, env, segments) {
  const resource = segments[0]; // study | projects | habits | routines
  const db = env.DB;
  const userId = request.user.id;

  if (resource === 'study') return studyRoute(request, db, userId, segments.slice(1));
  if (resource === 'projects') return projectsRoute(request, db, userId, segments.slice(1));
  if (resource === 'habits') return habitsRoute(request, db, userId, segments.slice(1));
  if (resource === 'routines') return routinesRoute(request, db, userId, segments.slice(1));

  return jsonError('Rota de desenvolvimento pessoal não encontrada.', 404);
}

// ---------- Estudos ----------

async function studyRoute(request, db, userId, [id, sub]) {
  if (!id) {
    if (request.method === 'GET') {
      const items = await StudyItems.listStudyItems(db, userId);
      return jsonOk({ items });
    }
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body) return jsonError('Corpo da requisição inválido.');
      const errors = validateRequiredFields(body, ['name']);
      if (errors) return jsonError('Informe o nome do curso/matéria.');

      const item = await StudyItems.createStudyItem(db, userId, {
        name: sanitizeText(body.name, { maxLength: 150 }),
        institution: body.institution ? sanitizeText(body.institution, { maxLength: 150 }) : null,
        totalHours: body.totalHours || null,
        deadline: body.deadline || null,
        priority: body.priority || 3
      });
      return jsonOk({ item }, 201);
    }
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'sessions' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body || !body.date) return jsonError('Informe a data da sessão.');
    if (body.minutes === undefined || body.minutes === null || body.minutes <= 0) {
      return jsonError('A duração precisa ser maior que zero.');
    }
    const futureError = validateNotFuture(body.date, 'Data da sessão');
    if (futureError) return jsonError(futureError);

    const item = await StudyItems.addStudySession(db, userId, id, { minutes: body.minutes, date: body.date });
    if (!item) return jsonError('Item de estudo não encontrado.', 404);

    const recentSessions = await StudyItems.listRecentStudySessions(db, id, addWeeks(new Date(), -4));
    const pace = calculateStudyPace(item, recentSessions);
    return jsonOk({ item, pace }, 201);
  }

  if (sub === 'pace' && request.method === 'GET') {
    const item = await db.prepare('SELECT * FROM study_items WHERE id = ? AND user_id = ?').bind(id, userId).first();
    if (!item) return jsonError('Item de estudo não encontrado.', 404);
    const recentSessions = await StudyItems.listRecentStudySessions(db, id, addWeeks(new Date(), -4));
    return jsonOk({ pace: calculateStudyPace(item, recentSessions) });
  }

  return jsonError('Rota de estudos não encontrada.', 404);
}

// ---------- Projetos ----------

async function projectsRoute(request, db, userId, [id, sub, taskId]) {
  if (!id) {
    if (request.method === 'GET') {
      const projects = await Projects.listProjects(db, userId);
      return jsonOk({ projects });
    }
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body) return jsonError('Corpo da requisição inválido.');
      const errors = validateRequiredFields(body, ['name']);
      if (errors) return jsonError('Informe o nome do projeto.');

      const budgetCents = body.budget !== undefined ? toCents(body.budget) : null;
      const project = await Projects.createProject(db, userId, {
        name: sanitizeText(body.name, { maxLength: 150 }),
        objective: body.objective ? sanitizeText(body.objective, { maxLength: 500 }) : null,
        deadline: body.deadline || null,
        budgetCents,
        priority: body.priority || 3
      });
      return jsonOk({ project }, 201);
    }
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'tasks') {
    if (request.method === 'GET') {
      const tasks = await Projects.listProjectTasks(db, id);
      return jsonOk({ tasks });
    }
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.title) return jsonError('Informe o título da tarefa.');
      const task = await Projects.createProjectTask(db, id, {
        title: sanitizeText(body.title, { maxLength: 200 }),
        dueDate: body.dueDate || null
      });
      return jsonOk({ task }, 201);
    }
    if (taskId && request.method === 'PATCH') {
      const body = await readJson(request);
      if (!body || body.done === undefined) return jsonError('Informe o novo status da tarefa.');
      const result = await Projects.toggleProjectTask(db, taskId, body.done);
      if (!result) return jsonError('Tarefa não encontrada.', 404);
      return jsonOk(result);
    }
  }

  return jsonError('Rota de projetos não encontrada.', 404);
}

// ---------- Hábitos ----------

async function habitsRoute(request, db, userId, [id, sub]) {
  if (!id) {
    if (request.method === 'GET') {
      const habits = await Habits.listHabits(db, userId);
      return jsonOk({ habits });
    }
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.name || !body.frequency) return jsonError('Informe nome e frequência do hábito.');
      const habit = await Habits.createHabit(db, userId, {
        name: sanitizeText(body.name, { maxLength: 150 }),
        frequency: body.frequency
      });
      return jsonOk({ habit }, 201);
    }
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'logs') {
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.date) return jsonError('Informe a data do registro.');
      const log = await Habits.toggleHabitLog(db, id, body.date, body.done !== false);
      return jsonOk({ log }, 201);
    }
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!start || !end) return jsonError('Informe o intervalo (start e end).');

      const logs = await Habits.listHabitLogsInRange(db, id, { start, end });
      const habit = await db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').bind(id, userId).first();
      if (!habit) return jsonError('Hábito não encontrado.', 404);

      const periodDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
      return jsonOk({
        logs,
        streak: calculateStreak(logs),
        complianceRate: calculateComplianceRate(logs, { periodDays, frequency: habit.frequency })
      });
    }
  }

  return jsonError('Rota de hábitos não encontrada.', 404);
}

// ---------- Rotinas ----------

async function routinesRoute(request, db, userId, [id, sub]) {
  if (!id) {
    if (request.method === 'GET') {
      const routines = await Routines.listRoutines(db, userId);
      return jsonOk({ routines });
    }
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.name || !body.period) return jsonError('Informe nome e período da rotina.');
      const routine = await Routines.createRoutine(db, userId, {
        name: sanitizeText(body.name, { maxLength: 150 }),
        period: body.period
      });
      return jsonOk({ routine }, 201);
    }
    return jsonError('Método não suportado.', 405);
  }

  if (sub === 'steps') {
    if (request.method === 'GET') {
      const steps = await Routines.listRoutineSteps(db, id);
      return jsonOk({ steps });
    }
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.title) return jsonError('Informe o título da etapa.');
      const step = await Routines.addRoutineStep(db, id, { title: sanitizeText(body.title, { maxLength: 150 }), orderIndex: body.orderIndex || 0 });
      return jsonOk({ step }, 201);
    }
  }

  if (sub === 'logs') {
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (!body || !body.date || body.completedSteps === undefined) {
        return jsonError('Informe data e quantidade de etapas concluídas.');
      }
      const steps = await Routines.listRoutineSteps(db, id);
      const rangeError = validateRange(body.completedSteps, 0, steps.length, 'Etapas concluídas');
      if (rangeError) return jsonError(rangeError);

      const log = await Routines.logRoutineExecution(db, id, body.date, body.completedSteps);
      return jsonOk({ log }, 201);
    }
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const start = url.searchParams.get('start');
      const end = url.searchParams.get('end');
      if (!start || !end) return jsonError('Informe o intervalo (start e end).');
      const logs = await Routines.listRoutineLogsInRange(db, id, { start, end });
      return jsonOk({ logs });
    }
  }

  return jsonError('Rota de rotinas não encontrada.', 404);
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
