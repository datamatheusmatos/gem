import { api } from '../api.js';
import { brl, escapeHtml } from '../format.js';

const TABS = ['Financeiro', 'Tempo', 'Revisão semanal', 'Revisão mensal'];
let activeTab = 0;

export async function renderReports(container) {
  container.innerHTML = `
    <h1 class="page-title">Relatórios</h1>
    <div class="tabs" id="report-tabs">
      ${TABS.map((t, i) => `<button class="tab-btn ${i === activeTab ? 'active' : ''}" data-tab="${i}">${t}</button>`).join('')}
    </div>
    <div id="report-content"></div>
  `;

  document.querySelectorAll('#report-tabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = parseInt(btn.dataset.tab, 10);
      document.querySelectorAll('#report-tabs .tab-btn').forEach((b, i) => b.classList.toggle('active', i === activeTab));
      renderActiveTab();
    };
  });

  await renderActiveTab();
}

async function renderActiveTab() {
  const el = document.getElementById('report-content');
  el.innerHTML = '<div class="empty-state">Carregando...</div>';
  if (activeTab === 0) return renderFinancial(el);
  if (activeTab === 1) return renderTime(el);
  if (activeTab === 2) return renderWeekly(el);
  return renderMonthly(el);
}

function monthRange() {
  const now = new Date();
  const start = `${now.toISOString().slice(0, 7)}-01`;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

async function renderFinancial(el) {
  const { start, end } = monthRange();
  try {
    const data = await api(`/reports/financial?start=${start}&end=${end}`);
    el.innerHTML = `
      <div class="form-row-2">
        <div class="card"><div class="label">Receitas</div><div class="value" style="color:var(--ok)">${brl(data.income)}</div></div>
        <div class="card"><div class="label">Despesas</div><div class="value" style="color:var(--danger)">${brl(data.expenses)}</div></div>
      </div>
      <div class="card"><div class="label">Patrimônio líquido</div><div class="value">${brl(data.netWorth)}</div></div>
      <div class="section-title">Despesas por categoria</div>
      ${data.expensesByCategory.length ? `<div class="card" style="padding:0">${data.expensesByCategory.map(c => `
        <div class="list-row"><div class="main"><div class="title">${escapeHtml(c.category)}</div></div><div class="amount despesa">${brl(c.total)}</div></div>
      `).join('')}</div>` : '<div class="empty-state">Nenhuma despesa categorizada neste mês.</div>'}
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function renderTime(el) {
  const { start, end } = monthRange();
  try {
    const data = await api(`/reports/time?start=${start}&end=${end}`);
    const categories = Object.entries(data.timeByCategory);
    el.innerHTML = `
      <div class="form-row-2">
        <div class="card"><div class="label">Horas de estudo</div><div class="value">${data.studyHours}h</div></div>
        <div class="card"><div class="label">Sessões de foco</div><div class="value">${data.focus.session_count}</div></div>
      </div>
      <div class="section-title">Tempo por categoria (horas)</div>
      ${categories.length ? `<div class="card" style="padding:0">${categories.map(([cat, hrs]) => `
        <div class="list-row"><div class="main"><div class="title">${escapeHtml(cat)}</div></div><div class="amount">${hrs}h</div></div>
      `).join('')}</div>` : '<div class="empty-state">Nenhum registro de tempo neste mês.</div>'}
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function renderWeekly(el) {
  try {
    const data = await api(`/reports/weekly-review?date=${new Date().toISOString().slice(0, 10)}`);
    el.innerHTML = `
      <p class="page-subtitle">Semana de ${data.period.start} a ${data.period.end}</p>
      <div class="form-row-2">
        <div class="card"><div class="label">Receitas</div><div class="value" style="font-size:16px;">${brl(data.financial.income)}</div></div>
        <div class="card"><div class="label">Despesas</div><div class="value" style="font-size:16px;">${brl(data.financial.expenses)}</div>
          ${data.financial.expensesChangePercent !== null ? `<div class="meta">${data.financial.expensesChangePercent >= 0 ? '+' : ''}${data.financial.expensesChangePercent}% vs semana anterior</div>` : ''}
        </div>
      </div>
      <div class="card"><div class="label">Cumprimento de hábitos</div><div class="value" style="font-size:16px;">${data.habitsCompliance.avg_compliance ?? '—'}%</div></div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function renderMonthly(el) {
  try {
    const data = await api(`/reports/monthly-review?month=${new Date().toISOString().slice(0, 7)}`);
    el.innerHTML = `
      <p class="page-subtitle">Mês: ${data.month}</p>
      <div class="form-row-2">
        <div class="card"><div class="label">Receitas</div><div class="value" style="font-size:16px;">${brl(data.financial.income)}</div></div>
        <div class="card"><div class="label">Despesas</div><div class="value" style="font-size:16px;">${brl(data.financial.expenses)}</div></div>
      </div>
      <div class="card"><div class="label">Patrimônio líquido</div><div class="value">${brl(data.financial.netWorth)}</div></div>
      <div class="card"><div class="label">Taxa de poupança</div><div class="value" style="font-size:16px;">${data.financial.savingsRatePercent}%</div></div>
      <div class="section-title">Desenvolvimento</div>
      <div class="form-row-2">
        <div class="card"><div class="label">Horas de estudo</div><div class="value" style="font-size:16px;">${data.development.studyHours}h</div></div>
        <div class="card"><div class="label">Cumprimento de hábitos</div><div class="value" style="font-size:16px;">${data.development.habitsCompliance.avg_compliance ?? '—'}%</div></div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}
