import { api } from '../api.js';
import { todayISO, escapeHtml } from '../format.js';

const EISENHOWER_LABELS = {
  fazer_agora: { label: 'Fazer agora', className: 'critico' },
  planejar: { label: 'Planejar', className: 'pendente' },
  delegar_ou_agilizar: { label: 'Agilizar', className: 'pendente' },
  eliminar_ou_adiar: { label: 'Adiar', className: 'ativa' }
};

let currentDate = todayISO();

export async function renderToday(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <h1 class="page-title" style="margin:0">Meu Dia</h1>
      <input type="date" id="day-filter" value="${currentDate}" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-family:inherit;">
    </div>

    <div id="time-plan-card" class="card raised" style="margin-top:14px;"></div>

    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div class="section-title" style="margin-bottom:0;">Compromissos</div>
      <button class="icon-btn" id="add-appointment-btn" title="Novo compromisso"><i class="ti ti-plus"></i></button>
    </div>
    <div id="appointments-list"><div class="empty-state">Carregando...</div></div>

    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div class="section-title" style="margin-bottom:0;">Tarefas</div>
      <button class="icon-btn" id="add-task-btn" title="Nova tarefa"><i class="ti ti-plus"></i></button>
    </div>
    <div id="tasks-list"><div class="empty-state">Carregando...</div></div>

    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div class="section-title" style="margin-bottom:0;">Treino</div>
      <a href="#treino" style="font-size:12px;color:var(--ice-dim);text-decoration:none;">ver detalhes →</a>
    </div>
    <div id="workout-summary-card" class="card"><div class="empty-state">Carregando...</div></div>

    <div class="section-title">Foco e energia</div>
    <div class="form-row-2">
      <button class="btn btn-secondary" id="log-focus-btn">Registrar sessão de foco</button>
      <button class="btn btn-secondary" id="log-energy-btn">Registrar energia de hoje</button>
    </div>

    <dialog id="appointment-dialog">
      <h2>Novo compromisso</h2>
      <form class="form-grid" id="appointment-form">
        <div><label>Título</label><input type="text" name="title" required maxlength="200"></div>
        <div class="form-row-2">
          <div><label>Início</label><input type="time" name="startTime" required></div>
          <div><label>Fim</label><input type="time" name="endTime" required></div>
        </div>
        <div><label>Local (opcional)</label><input type="text" name="location" maxlength="200"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="appointment-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="appointment-msg"></div>
      </form>
    </dialog>

    <dialog id="task-dialog">
      <h2>Nova tarefa</h2>
      <form class="form-grid" id="task-form">
        <div><label>Título</label><input type="text" name="title" required maxlength="200"></div>
        <div class="form-row-2">
          <div><label>Importância (1-5)</label><input type="number" name="importance" min="1" max="5" value="3"></div>
          <div><label>Urgência (1-5)</label><input type="number" name="urgency" min="1" max="5" value="3"></div>
        </div>
        <div><label>Esforço estimado (minutos)</label><input type="number" name="effortMinutes" min="1"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="task-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="task-msg"></div>
      </form>
    </dialog>

    <dialog id="focus-dialog">
      <h2>Registrar sessão de foco</h2>
      <form class="form-grid" id="focus-form">
        <div><label>Objetivo (opcional)</label><input type="text" name="objective" maxlength="200"></div>
        <div><label>Duração (minutos)</label><input type="number" name="durationMinutes" min="1" required value="25"></div>
        <div><label>Produtividade percebida (1-5, opcional)</label><input type="number" name="perceivedProductivity" min="1" max="5"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="focus-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="focus-msg"></div>
      </form>
    </dialog>

    <dialog id="energy-dialog">
      <h2>Como você está hoje?</h2>
      <form class="form-grid" id="energy-form">
        <div><label>Energia (1-5)</label><input type="number" name="energy" min="1" max="5" value="3"></div>
        <div><label>Estresse (1-5)</label><input type="number" name="stress" min="1" max="5" value="3"></div>
        <div><label>Qualidade do sono (1-5)</label><input type="number" name="sleepQuality" min="1" max="5" value="3"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="energy-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="energy-msg"></div>
      </form>
    </dialog>
  `;

  document.getElementById('day-filter').addEventListener('change', (e) => {
    currentDate = e.target.value;
    loadToday();
  });

  setupAppointmentDialog();
  setupTaskDialog();
  setupFocusDialog();
  setupEnergyDialog();

  await loadToday();
}

async function loadToday() {
  const planEl = document.getElementById('time-plan-card');
  const apptEl = document.getElementById('appointments-list');
  const taskEl = document.getElementById('tasks-list');
  try {
    const data = await api(`/time/today?date=${currentDate}`);

    const hours = Math.round(Math.abs(data.plan.available_minutes) / 6) / 10;
    planEl.innerHTML = data.plan.is_over_committed
      ? `<div class="label">Seu dia está sobrecarregado</div><div class="value" style="color:var(--danger);font-size:18px;">${hours}h além do disponível</div>`
      : `<div class="label">Tempo disponível hoje</div><div class="value" style="font-size:18px;">${hours}h livres</div>`;

    if (data.conflicts.length > 0) {
      planEl.innerHTML += `<div class="meta" style="color:var(--warn);margin-top:6px;">⚠ ${data.conflicts.length} conflito(s) de horário entre compromissos.</div>`;
    }

    apptEl.innerHTML = data.appointments.length
      ? `<div class="card" style="padding:0">${data.appointments.map(appointmentRow).join('')}</div>`
      : '<div class="empty-state">Nenhum compromisso hoje.</div>';

    taskEl.innerHTML = data.tasks.length
      ? `<div class="card" style="padding:0">${data.tasks.map(taskRow).join('')}</div>`
      : '<div class="empty-state">Nenhuma tarefa para hoje.</div>';

    attachRowHandlers();
  } catch (err) {
    planEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }

  loadWorkoutSummary();
}

async function loadWorkoutSummary() {
  const el = document.getElementById('workout-summary-card');
  try {
    const suggestion = await api(`/workouts/suggestion?date=${currentDate}`);
    if (!suggestion.applicable) {
      el.innerHTML = `<div class="empty-state">${escapeHtml(suggestion.reason)}</div>`;
      return;
    }
    el.innerHTML = `
      <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(suggestion.muscleGroupLabel)} · ${suggestion.targetMinutes} min</div>
      <div class="meta" style="margin-top:4px;">${suggestion.exercises.map(e => escapeHtml(e.name)).join(', ')}</div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function appointmentRow(a) {
  const start = a.start_at.slice(11, 16);
  const end = a.end_at.slice(11, 16);
  return `
    <div class="list-row" data-id="${a.id}">
      <div class="main"><div class="title">${escapeHtml(a.title)}</div><div class="meta">${start} – ${end}${a.location ? ' · ' + escapeHtml(a.location) : ''}</div></div>
      <div class="row-actions"><button class="icon-btn delete-appt-btn" title="Excluir"><i class="ti ti-trash"></i></button></div>
    </div>`;
}

function taskRow(t) {
  const eh = EISENHOWER_LABELS[t.eisenhower] || { label: t.eisenhower, className: 'pendente' };
  return `
    <div class="list-row" data-id="${t.id}">
      <div class="main">
        <div class="title" style="${t.done ? 'text-decoration:line-through;color:var(--text-secondary);' : ''}">${escapeHtml(t.title)}</div>
        <div class="meta"><span class="badge ${eh.className}">${eh.label}</span> ${t.effort_minutes ? `· ${t.effort_minutes}min` : ''}</div>
      </div>
      <div class="row-actions">
        <button class="icon-btn done-task-btn" title="Concluir"><i class="ti ti-check"></i></button>
        <button class="icon-btn delete-task-btn" title="Excluir"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function attachRowHandlers() {
  document.querySelectorAll('#appointments-list .delete-appt-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.closest('.list-row').dataset.id;
      if (!confirm('Excluir este compromisso?')) return;
      try { await api(`/time/appointments/${id}`, { method: 'DELETE' }); await loadToday(); }
      catch (err) { alert(err.message); }
    };
  });
  document.querySelectorAll('#tasks-list .done-task-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.closest('.list-row').dataset.id;
      try { await api(`/time/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done: true }) }); await loadToday(); }
      catch (err) { alert(err.message); }
    };
  });
  document.querySelectorAll('#tasks-list .delete-task-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.closest('.list-row').dataset.id;
      if (!confirm('Excluir esta tarefa?')) return;
      try { await api(`/time/tasks/${id}`, { method: 'DELETE' }); await loadToday(); }
      catch (err) { alert(err.message); }
    };
  });
}

function setupAppointmentDialog() {
  const dialog = document.getElementById('appointment-dialog');
  const form = document.getElementById('appointment-form');
  document.getElementById('add-appointment-btn').onclick = () => { form.reset(); document.getElementById('appointment-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('appointment-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('appointment-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/time/appointments', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          startAt: `${currentDate}T${fd.get('startTime')}:00Z`,
          endAt: `${currentDate}T${fd.get('endTime')}:00Z`,
          location: fd.get('location') || undefined
        })
      });
      dialog.close();
      await loadToday();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function setupTaskDialog() {
  const dialog = document.getElementById('task-dialog');
  const form = document.getElementById('task-form');
  document.getElementById('add-task-btn').onclick = () => { form.reset(); document.getElementById('task-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('task-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('task-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/time/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'), importance: parseInt(fd.get('importance'), 10), urgency: parseInt(fd.get('urgency'), 10),
          effortMinutes: fd.get('effortMinutes') ? parseInt(fd.get('effortMinutes'), 10) : undefined, dueDate: currentDate
        })
      });
      dialog.close();
      await loadToday();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function setupFocusDialog() {
  const dialog = document.getElementById('focus-dialog');
  const form = document.getElementById('focus-form');
  document.getElementById('log-focus-btn').onclick = () => { form.reset(); form.durationMinutes.value = 25; document.getElementById('focus-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('focus-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('focus-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const now = new Date();
    try {
      await api('/wellbeing/focus-sessions', {
        method: 'POST',
        body: JSON.stringify({
          objective: fd.get('objective') || undefined,
          durationMinutes: parseInt(fd.get('durationMinutes'), 10),
          perceivedProductivity: fd.get('perceivedProductivity') ? parseInt(fd.get('perceivedProductivity'), 10) : undefined,
          startedAt: now.toISOString()
        })
      });
      dialog.close();
      msg.textContent = '';
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function setupEnergyDialog() {
  const dialog = document.getElementById('energy-dialog');
  const form = document.getElementById('energy-form');
  document.getElementById('log-energy-btn').onclick = () => { form.reset(); document.getElementById('energy-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('energy-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('energy-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/wellbeing/energy-logs', {
        method: 'POST',
        body: JSON.stringify({
          date: currentDate,
          energy: parseInt(fd.get('energy'), 10),
          stress: parseInt(fd.get('stress'), 10),
          sleepQuality: parseInt(fd.get('sleepQuality'), 10)
        })
      });
      dialog.close();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
