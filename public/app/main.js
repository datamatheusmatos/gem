import { registerRoute, startRouter } from './router.js';
import { api } from './api.js';
import { setCurrency } from './format.js';
import { renderDashboard } from './dashboard/dashboard.js';
import { renderFinance } from './finance/finance.js';
import { renderGoals } from './goals/goals.js';
import { renderToday } from './today/today.js';
import { renderGrowth } from './growth/growth.js';
import { renderAssistant } from './assistant/assistant.js';
import { renderReports } from './reports/reports.js';
import { renderSettings } from './settings/settings.js';
import { renderOnboarding } from './onboarding/onboarding.js';
import { renderWorkout } from './workout/workout.js';

registerRoute('dashboard', { label: 'Dashboard', icon: 'home', render: renderDashboard, primary: true });
registerRoute('today', { label: 'Meu Dia', icon: 'calendar-event', render: renderToday, primary: true });
registerRoute('financeiro', { label: 'Financeiro', icon: 'wallet', render: renderFinance, primary: true });
registerRoute('metas', { label: 'Metas', icon: 'target-arrow', render: renderGoals, primary: true });
registerRoute('growth', { label: 'Desenvolvimento', icon: 'school', render: renderGrowth });
registerRoute('treino', { label: 'Treino', icon: 'barbell', render: renderWorkout });
registerRoute('assistente', { label: 'Assistente', icon: 'bulb', render: renderAssistant });
registerRoute('relatorios', { label: 'Relatórios', icon: 'chart-bar', render: renderReports });
registerRoute('config', { label: 'Configurações', icon: 'settings', render: renderSettings });
registerRoute('onboarding', { label: 'Boas-vindas', icon: 'sparkles', render: renderOnboarding, hidden: true, fullScreen: true });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Primeira execução: se o onboarding ainda não foi concluído e o usuário não
// navegou para uma URL específica de propósito, manda para o assistente de
// boas-vindas (seção 58) em vez do Dashboard vazio. Aproveitamos a mesma
// chamada para carregar a moeda preferida do usuário — é o que faz o campo
// "Moeda" de Configurações realmente valer em toda formatação monetária do
// app, em vez de só ficar salvo sem efeito.
async function loadUserPreferencesAndMaybeRedirect() {
  try {
    const { settings } = await api('/settings');
    setCurrency(settings.currency);
    if (!settings.onboardingCompleted && (!location.hash || location.hash === '#dashboard')) {
      location.hash = 'onboarding';
    }
  } catch { /* se a checagem falhar, segue com BRL padrão e Dashboard normal */ }
}

await loadUserPreferencesAndMaybeRedirect();
startRouter();
