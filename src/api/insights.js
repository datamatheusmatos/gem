import { jsonError, jsonOk } from '../shared/http.js';
import { FinancialEngine } from '../engine/FinancialEngine.js';
import { DecisionEngine } from '../engine/DecisionEngine.js';
import { listRecentInsights } from '../db/insights.js';
import { listUnreadNotifications, markNotificationRead } from '../db/notifications.js';

export async function handleInsights(request, env, segments) {
  const action = segments[0];
  const db = env.DB;
  const userId = request.user.id;
  const financialEngine = new FinancialEngine(db);
  const decisionEngine = new DecisionEngine(financialEngine, db);

  if (action === 'generate' && request.method === 'POST') {
    const [insights, alerts] = await Promise.all([
      decisionEngine.generateInsights(userId),
      decisionEngine.generateAlerts(userId)
    ]);
    return jsonOk({ insights, alerts }, 201);
  }

  if (action === 'recent' && request.method === 'GET') {
    const insights = await listRecentInsights(db, userId);
    return jsonOk({ insights: insights.map(i => ({ ...i, data: safeParse(i.data_json) })) });
  }

  if (action === 'notifications' && request.method === 'GET') {
    const notifications = await listUnreadNotifications(db, userId);
    return jsonOk({ notifications });
  }

  if (action === 'notifications' && segments[1] && request.method === 'PATCH') {
    const ok = await markNotificationRead(db, userId, segments[1]);
    if (!ok) return jsonError('Notificação não encontrada.', 404);
    return jsonOk({ ok: true });
  }

  if (action === 'priorities' && request.method === 'GET') {
    const priorities = await decisionEngine.recalculatePriorities(userId);
    return jsonOk({ priorities });
  }

  if (action === 'conflicts' && request.method === 'GET') {
    const conflicts = await decisionEngine.detectConflicts(userId);
    return jsonOk({ conflicts });
  }

  return jsonError('Rota do assistente não encontrada.', 404);
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}
