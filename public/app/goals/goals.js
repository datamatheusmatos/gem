import { api } from '../api.js';
import { brl, formatDateBR, todayISO, escapeHtml } from '../format.js';

let cachedGoals = [];

export async function renderGoals(container) {
  container.innerHTML = `
    <h1 class="page-title">Metas</h1>
    <div id="goals-list" style="margin-top:16px;"><div class="empty-state">Carregando...</div></div>

    <dialog id="goal-dialog">
      <h2>Nova meta</h2>
      <form class="form-grid" id="goal-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="120" placeholder="Ex.: Viagem para o Chile"></div>
        <div style="display:flex;gap:14px;font-size:13px;color:var(--text);">
          <label style="display:flex;align-items:center;gap:6px;"><input type="radio" name="kind" value="financeira" checked style="width:auto;"> Meta financeira</label>
          <label style="display:flex;align-items:center;gap:6px;"><input type="radio" name="kind" value="geral" style="width:auto;"> Meta geral</label>
        </div>

        <div id="goal-financial-fields">
          <div class="form-row-2">
            <div><label>Valor-alvo (R$)</label><input type="number" name="targetAmount" step="0.01" min="0.01"></div>
            <div><label>Já tenho (R$)</label><input type="number" name="currentAmount" step="0.01" value="0"></div>
          </div>
          <div class="form-row-2">
            <div><label>Prazo</label><input type="date" name="deadline"></div>
            <div><label>Contribuição mensal (R$)</label><input type="number" name="monthlyContribution" step="0.01"></div>
          </div>
        </div>

        <div id="goal-general-fields" style="display:none;">
          <div><label>Métrica (ex.: livros, km, horas)</label><input type="text" name="metric" maxlength="80"></div>
          <div class="form-row-2">
            <div><label>Progresso atual</label><input type="number" name="progressCurrent" step="0.01"></div>
            <div><label>Progresso alvo</label><input type="number" name="progressTarget" step="0.01"></div>
          </div>
        </div>

        <div class="row">
          <button type="button" class="btn btn-secondary" id="goal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="goal-msg"></div>
      </form>
    </dialog>

    <dialog id="contribution-dialog">
      <h2>Registrar contribuição</h2>
      <form class="form-grid" id="contribution-form">
        <div><label>Valor (R$)</label><input type="number" name="amount" step="0.01" min="0.01" required></div>
        <div><label>Data</label><input type="date" name="date" required></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="contribution-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
        <div class="form-msg" id="contribution-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-goal" aria-label="Nova meta">+</button>
  `;

  const dialog = document.getElementById('goal-dialog');
  const form = document.getElementById('goal-form');
  const msg = document.getElementById('goal-msg');

  form.querySelectorAll('input[name="kind"]').forEach(radio => {
    radio.onchange = () => {
      const isFinancial = form.kind.value === 'financeira';
      document.getElementById('goal-financial-fields').style.display = isFinancial ? '' : 'none';
      document.getElementById('goal-general-fields').style.display = isFinancial ? 'none' : '';
    };
  });

  document.getElementById('fab-add-goal').onclick = () => {
    form.reset();
    document.getElementById('goal-financial-fields').style.display = '';
    document.getElementById('goal-general-fields').style.display = 'none';
    msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('goal-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const isFinancial = fd.get('kind') === 'financeira';
    const payload = { name: fd.get('name') };

    if (isFinancial) {
      if (fd.get('targetAmount')) payload.targetAmount = fd.get('targetAmount');
      if (fd.get('currentAmount')) payload.currentAmount = fd.get('currentAmount');
      if (fd.get('deadline')) payload.deadline = fd.get('deadline');
      if (fd.get('monthlyContribution')) payload.monthlyContribution = fd.get('monthlyContribution');
    } else {
      if (fd.get('metric')) payload.metric = fd.get('metric');
      if (fd.get('progressCurrent')) payload.progressCurrent = parseFloat(fd.get('progressCurrent'));
      if (fd.get('progressTarget')) payload.progressTarget = parseFloat(fd.get('progressTarget'));
    }

    try {
      await api('/goals', { method: 'POST', body: JSON.stringify(payload) });
      dialog.close();
      await loadGoals();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const contribDialog = document.getElementById('contribution-dialog');
  document.getElementById('contribution-cancel').onclick = () => contribDialog.close();

  document.getElementById('contribution-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const cmsg = document.getElementById('contribution-msg');
    cmsg.textContent = ''; cmsg.classList.remove('error');

    const fd = new FormData(e.target);
    const goalId = contribDialog.dataset.goalId;
    try {
      await api(`/goals/${goalId}/contributions`, { method: 'POST', body: JSON.stringify({ amount: fd.get('amount'), date: fd.get('date') }) });
      contribDialog.close();
      await loadGoals();
    } catch (err) {
      cmsg.textContent = err.message; cmsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadGoals();
}

async function loadGoals() {
  const listEl = document.getElementById('goals-list');
  try {
    const { goals } = await api('/goals');
    cachedGoals = goals;
    listEl.innerHTML = goals.length ? goals.map(goalCard).join('') : '<div class="empty-state">Nenhuma meta ainda. Toque em + para criar a primeira.</div>';
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function goalCard(g) {
  const isFinancial = g.plan.applicable || g.targetAmount !== null;

  if (isFinancial && g.plan.applicable) {
    const percent = g.targetAmount > 0 ? Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100) : 0;
    return `
      <div class="card" data-id="${g.id}">
        <div style="display:flex;justify-content:space-between;">
          <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(g.name)}</div>
          ${g.plan.isBehindSchedule ? '<span class="badge critico">atrasada</span>' : '<span class="badge ativa">no prazo</span>'}
        </div>
        <div style="margin-top:8px;font-size:15px;font-weight:600;">${brl(g.currentAmount)} <span style="font-size:12px;font-weight:400;color:var(--text-secondary);">de ${brl(g.targetAmount)}</span></div>
        <div class="progress-bar"><div class="fill" style="width:${percent}%"></div></div>
        <div class="meta" style="margin-top:8px;">Prazo: ${formatDateBR(g.deadline)} · contribuindo ${brl(g.monthlyContribution)}/mês</div>
        ${g.plan.isBehindSchedule
          ? `<div class="meta" style="color:var(--warn);margin-top:4px;">Para ficar no prazo, aumente a contribuição em ${brl(g.plan.requiredIncrease)}/mês.</div>`
          : ''}
        <div class="row" style="margin-top:12px;">
          <button class="btn btn-secondary contribute-btn" style="flex:1;">Registrar contribuição</button>
        </div>
      </div>`;
  }

  const percent = g.progressTarget > 0 ? Math.min(Math.round((g.progressCurrent / g.progressTarget) * 100), 100) : 0;
  return `
    <div class="card" data-id="${g.id}">
      <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(g.name)}</div>
      <div style="margin-top:8px;font-size:15px;font-weight:600;">${g.progressCurrent ?? 0} <span style="font-size:12px;font-weight:400;color:var(--text-secondary);">de ${g.progressTarget ?? '?'} ${escapeHtml(g.metric || '')}</span></div>
      <div class="progress-bar"><div class="fill" style="width:${percent}%"></div></div>
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll('#goals-list .contribute-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.card').dataset.id;
      const dialog = document.getElementById('contribution-dialog');
      dialog.dataset.goalId = id;
      document.getElementById('contribution-form').reset();
      document.getElementById('contribution-form').date.value = todayISO();
      document.getElementById('contribution-msg').textContent = '';
      dialog.showModal();
    };
  });
}
