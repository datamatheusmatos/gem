import { api } from '../api.js';
import { brl, currentMonthISO, todayISO, escapeHtml } from '../format.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <h1 class="page-title">Dashboard</h1>
    <p class="page-subtitle" id="today-label"></p>

    <div class="card raised">
      <div class="label">Você pode gastar até</div>
      <div class="value" id="available-value">—</div>
      <div class="page-subtitle" id="available-sub" style="margin:4px 0 0"></div>
      <div class="form-row-2" style="margin-top:14px">
        <div class="card" style="margin-bottom:0"><div class="label">Diário recomendado</div><div class="value" style="font-size:16px" id="daily-value">—</div></div>
        <div class="card" style="margin-bottom:0"><div class="label">Semanal recomendado</div><div class="value" style="font-size:16px" id="weekly-value">—</div></div>
      </div>
    </div>

    <div class="section-title">Seu resumo de hoje</div>
    <div id="today-summary" class="card"><div class="empty-state">Carregando...</div></div>

    <div class="section-title">Insights</div>
    <div id="insights-list"><div class="empty-state">Nenhum insight ainda — use o app por alguns dias.</div></div>

    <div class="section-title">Alertas</div>
    <div id="alerts-list"><div class="empty-state">Nenhum alerta no momento.</div></div>
  `;

  document.getElementById('today-label').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long'
  });

  loadSpendingLimit();
  loadTodaySummary();
  loadInsightsAndAlerts();
}

async function loadSpendingLimit() {
  try {
    const data = await api(`/engine/spending-limit?month=${currentMonthISO()}`);
    document.getElementById('available-value').textContent = brl(data.available);
    document.getElementById('available-sub').textContent = `${data.daysRemaining} dias restantes neste mês`;
    document.getElementById('daily-value').textContent = brl(data.daily);
    document.getElementById('weekly-value').textContent = brl(data.weekly);
  } catch (err) {
    document.getElementById('available-sub').textContent = err.message;
  }
}

async function loadTodaySummary() {
  const el = document.getElementById('today-summary');
  try {
    const data = await api(`/time/today?date=${todayISO()}`);
    const parts = [];
    if (data.appointments.length > 0) parts.push(`${data.appointments.length} compromisso(s) hoje.`);
    if (data.tasks.length > 0) parts.push(`${data.tasks.length} tarefa(s) pendente(s), prioridade máxima: "${escapeHtml(data.tasks[0].title)}".`);
    if (data.plan.is_over_committed) {
      parts.push(`Seu planejamento de hoje excede o tempo disponível em ${Math.abs(Math.round(data.plan.available_minutes / 6) / 10)}h.`);
    } else {
      parts.push(`Você tem ${Math.round(data.plan.available_minutes / 6) / 10}h livres hoje.`);
    }
    el.innerHTML = parts.map(p => `<p style="margin:0 0 8px;font-size:13.5px;line-height:1.5">${p}</p>`).join('') || '<div class="empty-state">Nada registrado para hoje.</div>';
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadInsightsAndAlerts() {
  const insightsEl = document.getElementById('insights-list');
  const alertsEl = document.getElementById('alerts-list');
  try {
    const { insights } = await api('/insights/recent');
    insightsEl.innerHTML = insights.length
      ? insights.slice(0, 5).map(i => `<div class="card">${escapeHtml(i.message)}</div>`).join('')
      : '<div class="empty-state">Nenhum insight ainda — use o app por alguns dias.</div>';
  } catch {
    insightsEl.innerHTML = '<div class="empty-state">Não foi possível carregar os insights.</div>';
  }

  try {
    const { notifications } = await api('/insights/notifications');
    alertsEl.innerHTML = notifications.length
      ? notifications.map(n => `<div class="card">${escapeHtml(n.message)}</div>`).join('')
      : '<div class="empty-state">Nenhum alerta no momento.</div>';
  } catch {
    alertsEl.innerHTML = '<div class="empty-state">Não foi possível carregar os alertas.</div>';
  }
}
