import { api } from '../api.js';
import { escapeHtml } from '../format.js';

export async function renderAssistant(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h1 class="page-title" style="margin:0">Assistente</h1>
      <button class="btn btn-secondary" id="generate-btn">Atualizar análise</button>
    </div>

    <div class="section-title">Alertas</div>
    <div id="alerts-list"><div class="empty-state">Carregando...</div></div>

    <div class="section-title">Insights</div>
    <div id="insights-list"><div class="empty-state">Carregando...</div></div>

    <div class="section-title">Prioridades</div>
    <div id="priorities-list"><div class="empty-state">Carregando...</div></div>

    <div class="section-title">Conflitos</div>
    <div id="conflicts-list"><div class="empty-state">Carregando...</div></div>
  `;

  document.getElementById('generate-btn').onclick = async () => {
    const btn = document.getElementById('generate-btn');
    btn.disabled = true; btn.textContent = 'Analisando...';
    try {
      await api('/insights/generate', { method: 'POST' });
      await loadAll();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Atualizar análise';
    }
  };

  await loadAll();
}

async function loadAll() {
  await Promise.all([loadAlerts(), loadInsights(), loadPriorities(), loadConflicts()]);
}

async function loadAlerts() {
  const el = document.getElementById('alerts-list');
  try {
    const { notifications } = await api('/insights/notifications');
    el.innerHTML = notifications.length
      ? notifications.map(n => `
          <div class="card" data-id="${n.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <span class="badge ${n.level}">${n.level}</span>
              <button class="icon-btn mark-read-btn" title="Marcar como lido"><i class="ti ti-check"></i></button>
            </div>
            <div style="margin-top:8px;font-size:13.5px;">${escapeHtml(n.message)}</div>
          </div>`).join('')
      : '<div class="empty-state">Nenhum alerta no momento.</div>';

    el.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.closest('.card').dataset.id;
        try { await api(`/insights/notifications/${id}`, { method: 'PATCH' }); await loadAlerts(); }
        catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadInsights() {
  const el = document.getElementById('insights-list');
  try {
    const { insights } = await api('/insights/recent');
    el.innerHTML = insights.length
      ? insights.map(i => `<div class="card">${escapeHtml(i.message)}</div>`).join('')
      : '<div class="empty-state">Nenhum insight ainda — toque em "Atualizar análise" ou use o app por alguns dias.</div>';
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadPriorities() {
  const el = document.getElementById('priorities-list');
  try {
    const { priorities } = await api('/insights/priorities');
    el.innerHTML = priorities.length
      ? `<div class="card" style="padding:0">${priorities.map(p => `
          <div class="list-row"><div class="main"><div class="title">${escapeHtml(p.title)}</div><div class="meta">${p.type}</div></div><div class="amount">${p.score}</div></div>
        `).join('')}</div>`
      : '<div class="empty-state">Nenhuma prioridade calculada ainda.</div>';
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

async function loadConflicts() {
  const el = document.getElementById('conflicts-list');
  try {
    const { conflicts } = await api('/insights/conflicts');
    el.innerHTML = conflicts.length
      ? conflicts.map(c => `<div class="card" style="border-color:rgba(224,121,107,0.4);">${escapeHtml(c.message)}</div>`).join('')
      : '<div class="empty-state">Nenhum conflito identificado.</div>';
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}
