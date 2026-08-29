import { api } from '../api.js';
import { todayISO, escapeHtml } from '../format.js';

const PERIOD_LABELS = { manha: 'Manhã', trabalho: 'Trabalho', noite: 'Noite', estudos: 'Estudos', fim_de_semana: 'Fim de semana' };

let cachedSteps = {};

export async function renderRoutines(container) {
  container.innerHTML = `
    <div id="routines-list"><div class="empty-state">Carregando...</div></div>

    <dialog id="routine-dialog">
      <h2>Nova rotina</h2>
      <form class="form-grid" id="routine-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="150" placeholder="Ex.: Rotina da manhã"></div>
        <div><label>Período</label>
          <select name="period">
            ${Object.entries(PERIOD_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="routine-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="routine-msg"></div>
      </form>
    </dialog>

    <dialog id="step-dialog">
      <h2>Nova etapa</h2>
      <form class="form-grid" id="step-form">
        <div><label>Título da etapa</label><input type="text" name="title" required maxlength="150"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="step-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Adicionar</button>
        </div>
        <div class="form-msg" id="step-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-routine" aria-label="Nova rotina">+</button>
  `;

  const dialog = document.getElementById('routine-dialog');
  const form = document.getElementById('routine-form');
  document.getElementById('fab-add-routine').onclick = () => { form.reset(); document.getElementById('routine-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('routine-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('routine-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/growth/routines', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), period: fd.get('period') }) });
      dialog.close();
      await loadRoutines();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const stepDialog = document.getElementById('step-dialog');
  document.getElementById('step-cancel').onclick = () => stepDialog.close();

  document.getElementById('step-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const smsg = document.getElementById('step-msg');
    smsg.textContent = ''; smsg.classList.remove('error');

    const fd = new FormData(e.target);
    const routineId = stepDialog.dataset.routineId;
    try {
      await api(`/growth/routines/${routineId}/steps`, { method: 'POST', body: JSON.stringify({ title: fd.get('title'), orderIndex: (cachedSteps[routineId] || []).length }) });
      stepDialog.close();
      await loadSteps(routineId);
    } catch (err) {
      smsg.textContent = err.message; smsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadRoutines();
}

let cachedRoutines = [];

async function loadRoutines() {
  const listEl = document.getElementById('routines-list');
  try {
    const { routines } = await api('/growth/routines');
    cachedRoutines = routines;
    listEl.innerHTML = routines.length ? routines.map(routineCard).join('') : '<div class="empty-state">Nenhuma rotina cadastrada.</div>';
    for (const r of routines) await loadSteps(r.id);
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function routineCard(r) {
  return `
    <div class="card" data-id="${r.id}">
      <div style="display:flex;justify-content:space-between;">
        <div>
          <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(r.name)}</div>
          <div class="meta">${PERIOD_LABELS[r.period] || r.period}</div>
        </div>
        <button class="icon-btn add-step-btn" title="Adicionar etapa"><i class="ti ti-plus"></i></button>
      </div>
      <div id="steps-for-${r.id}" style="margin-top:10px;"></div>
      <button class="btn btn-secondary log-execution-btn" style="margin-top:10px;width:100%;">Registrar execução de hoje</button>
    </div>`;
}

async function loadSteps(routineId) {
  const el = document.getElementById(`steps-for-${routineId}`);
  if (!el) return;
  try {
    const { steps } = await api(`/growth/routines/${routineId}/steps`);
    cachedSteps[routineId] = steps;
    el.innerHTML = steps.length
      ? steps.map(s => `<div class="meta" style="padding:3px 0;">• ${escapeHtml(s.title)}</div>`).join('')
      : '<div class="meta">Nenhuma etapa ainda.</div>';
  } catch {
    el.innerHTML = '';
  }
}

function attachHandlers() {
  document.querySelectorAll('#routines-list .add-step-btn').forEach(btn => {
    btn.onclick = () => {
      const routineId = btn.closest('.card').dataset.id;
      const dialog = document.getElementById('step-dialog');
      dialog.dataset.routineId = routineId;
      document.getElementById('step-form').reset();
      document.getElementById('step-msg').textContent = '';
      dialog.showModal();
    };
  });
  document.querySelectorAll('#routines-list .log-execution-btn').forEach(btn => {
    btn.onclick = async () => {
      const routineId = btn.closest('.card').dataset.id;
      const totalSteps = (cachedSteps[routineId] || []).length;
      const completed = totalSteps > 0 ? parseInt(prompt(`Quantas das ${totalSteps} etapas você concluiu hoje?`, totalSteps), 10) : 0;
      if (Number.isNaN(completed)) return;
      try {
        await api(`/growth/routines/${routineId}/logs`, { method: 'POST', body: JSON.stringify({ date: todayISO(), completedSteps: completed }) });
        alert('Execução registrada.');
      } catch (err) {
        alert(err.message);
      }
    };
  });
}
