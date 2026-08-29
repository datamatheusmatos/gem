import { requireAccessUser } from '../auth/access.js';
import { jsonError } from '../shared/http.js';
import { handleFinance } from './finance.js';
import { handleEngine } from './engine.js';
import { handleGoals } from './goals.js';
import { handleTime } from './time.js';
import { handleWellbeing } from './wellbeing.js';
import { handleGrowth } from './growth.js';
import { handleInsights } from './insights.js';
import { handleReports } from './reports.js';
import { handleDebts } from './debts.js';
import { handleInvestments } from './investments.js';
import { handleSettings } from './settings.js';
import { handleBackup } from './backup.js';
import { handleWorkouts } from './workouts.js';

// Cada domínio será implementado como um módulo próprio nas Fases 3-9.
// Este router fica fino de propósito: identifica o usuário (via Cloudflare Access),
// despacha, nada de regra de negócio aqui.
const routes = {
  finance: (request, env, ctx, segments) => handleFinance(request, env, segments),
  engine: (request, env, ctx, segments) => handleEngine(request, env, segments),
  goals: (request, env, ctx, segments) => handleGoals(request, env, segments),
  time: (request, env, ctx, segments) => handleTime(request, env, segments),
  wellbeing: (request, env, ctx, segments) => handleWellbeing(request, env, segments),
  growth: (request, env, ctx, segments) => handleGrowth(request, env, segments),
  insights: (request, env, ctx, segments) => handleInsights(request, env, segments),
  reports: (request, env, ctx, segments) => handleReports(request, env, segments),
  debts: (request, env, ctx, segments) => handleDebts(request, env, segments),
  investments: (request, env, ctx, segments) => handleInvestments(request, env, segments),
  settings: (request, env) => handleSettings(request, env),
  backup: (request, env, ctx, segments) => handleBackup(request, env, segments),
  workouts: (request, env, ctx, segments) => handleWorkouts(request, env, segments),
};

export async function handleApi(request, env, ctx, url) {
  const segments = url.pathname.split('/').filter(Boolean); // ['api', 'dominio', 'acao', ...]
  const domain = segments[1];

  const user = await requireAccessUser(request, env);
  if (!user) {
    // Não deveria acontecer em produção (o Access barra antes) — defesa em profundidade.
    return jsonError('Não foi possível identificar seu acesso. Faça login novamente.', 401);
  }
  request.user = user;

  const handler = routes[domain];
  if (!handler) {
    return jsonError('Rota não encontrada.', 404);
  }
  return handler(request, env, ctx, segments.slice(2));
}
