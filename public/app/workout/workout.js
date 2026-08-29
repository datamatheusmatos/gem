import { api } from '../api.js';
import { todayISO, escapeHtml } from '../format.js';

const DIFFICULTY_LABELS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' };

export async function renderWorkout(container) {
  container.innerHTML = `
    <h1 class="page-title">Treino</h1>
    <div class="tabs" id="workout-tabs">
      <button class="tab-btn active" data-tab="hoje">Hoje</button>
      <button class="tab-btn" data-tab="historico">Histórico</button>
      <button class="tab-btn" data-tab="excluidos">Exercícios excluídos</button>
    </div>
    <div id="workout-tab-content"></div>
  `;

  let activeTab = 'hoje';
  document.querySelectorAll('#workout-tabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('#workout-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
      renderTab();
    };
  });

  async function renderTab() {
    const content = document.getElementById('workout-tab-content');
    content.innerHTML = '<div class="empty-state">Carregando...</div>';
    if (activeTab === 'hoje') return renderToday(content);
    if (activeTab === 'historico') return renderHistory(content);
    return renderExcluded(content);
  }

  await renderTab();
}

// ---------- Sugestão de hoje ----------

async function renderToday(container) {
  try {
    const suggestion = await api(`/workouts/suggestion?date=${todayISO()}`);

    if (!suggestion.applicable) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(suggestion.reason)}</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card raised">
        <div class="label">Foco de hoje</div>
        <div class="value" style="font-size:20px;">${escapeHtml(suggestion.muscleGroupLabel)}</div>
        <div class="meta" style="margin-top:6px;">${suggestion.explanation.map(escapeHtml).join(' ')}</div>
      </div>
      <div id="exercise-list"></div>
      <button class="btn btn-primary btn-block" id="log-workout-btn" style="margin-top:14px;">Registrar treino concluído</button>

      <dialog id="log-dialog">
        <h2>Registrar treino</h2>
        <form class="form-grid" id="log-form">
          <div><label>Duração real (minutos)</label><input type="number" name="durationMinutes" min="1" value="${suggestion.targetMinutes}"></div>
          <div><label>Esforço percebido (1-5)</label><input type="number" name="perceivedEffort" min="1" max="5" value="3"></div>
          <div class="row">
            <button type="button" class="btn btn-secondary" id="log-cancel">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
          <div class="form-msg" id="log-msg"></div>
        </form>
      </dialog>
    `;

    document.getElementById('exercise-list').innerHTML = suggestion.exercises.map(exerciseCard).join('');

    const dialog = document.getElementById('log-dialog');
    document.getElementById('log-workout-btn').onclick = () => {
      document.getElementById('log-msg').textContent = '';
      dialog.showModal();
    };
    document.getElementById('log-cancel').onclick = () => dialog.close();

    document.getElementById('log-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      const msg = document.getElementById('log-msg');
      msg.textContent = ''; msg.classList.remove('error');

      const fd = new FormData(e.target);
      try {
        await api('/workouts/sessions', {
          method: 'POST',
          body: JSON.stringify({
            date: todayISO(),
            muscleGroups: suggestion.muscleGroup,
            durationMinutes: parseInt(fd.get('durationMinutes'), 10) || undefined,
            perceivedEffort: parseInt(fd.get('perceivedEffort'), 10),
            exercises: suggestion.exercises.map(ex => ({ exerciseId: ex.id, sets: ex.sets, reps: ex.reps }))
          })
        });
        dialog.close();
        await renderToday(container);
      } catch (err) {
        msg.textContent = err.message; msg.classList.add('error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function exerciseCard(ex) {
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;">
        <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(ex.name)}</div>
        <span class="badge ${ex.difficulty === 'avancado' ? 'critico' : ex.difficulty === 'intermediario' ? 'pendente' : 'ativa'}">${DIFFICULTY_LABELS[ex.difficulty]}</span>
      </div>
      <div style="margin-top:6px;font-size:15px;font-weight:600;">${ex.sets}x${ex.reps}${ex.isProgression ? ' <span style="font-size:11px;font-weight:400;color:var(--ok);">↑ progressão</span>' : ''}</div>
      <div class="meta" style="margin-top:6px;">${escapeHtml(ex.instructions || '')}</div>
    </div>`;
}

// ---------- Histórico ----------

async function renderHistory(container) {
  const end = todayISO();
  const start = new Date(); start.setDate(start.getDate() - 60);
  const startISO = start.toISOString().slice(0, 10);

  try {
    const { sessions } = await api(`/workouts/sessions?start=${startISO}&end=${end}`);
    container.innerHTML = sessions.length
      ? sessions.map(sessionCard).join('')
      : '<div class="empty-state">Nenhum treino registrado nos últimos 60 dias.</div>';

    container.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Excluir este registro de treino?')) return;
        try {
          await api(`/workouts/sessions/${btn.closest('.card').dataset.id}`, { method: 'DELETE' });
          await renderHistory(container);
        } catch (err) { alert(err.message); }
      };
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function sessionCard(s) {
  return `
    <div class="card" data-id="${s.id}">
      <div style="display:flex;justify-content:space-between;">
        <div class="title" style="font-size:14px;font-weight:500;">${s.date} — ${escapeHtml(s.muscle_groups)}</div>
        <button class="icon-btn delete-session-btn" title="Excluir"><i class="ti ti-trash"></i></button>
      </div>
      <div class="meta">${s.duration_minutes ? `${s.duration_minutes} min · ` : ''}${s.perceived_effort ? `esforço ${s.perceived_effort}/5` : ''}</div>
      <div class="meta" style="margin-top:6px;">${s.exercises.map(e => `${escapeHtml(e.name)} ${e.sets}x${e.reps}`).join(' · ')}</div>
    </div>`;
}

// ---------- Exercícios excluídos ----------

async function renderExcluded(container) {
  try {
    const [{ excluded }, { exercises }] = await Promise.all([
      api('/workouts/excluded-exercises'), api('/workouts/exercises')
    ]);

    const excludedIds = new Set(excluded.map(e => e.id));
    const available = exercises.filter(e => !excludedIds.has(e.id));

    container.innerHTML = `
      <div class="section-title">Excluídos</div>
      ${excluded.length ? excluded.map(e => `
        <div class="list-row" data-id="${e.id}">
          <div class="main"><div class="title">${escapeHtml(e.name)}</div>${e.reason ? `<div class="meta">${escapeHtml(e.reason)}</div>` : ''}</div>
          <button class="icon-btn readd-btn" title="Reincluir"><i class="ti ti-arrow-back-up"></i></button>
        </div>`).join('') : '<div class="empty-state">Nenhum exercício excluído.</div>'}

      <div class="section-title">Excluir um exercício</div>
      <form class="form-grid" id="exclude-form">
        <select name="exerciseId" required>
          <option value="">Escolha um exercício</option>
          ${available.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
        </select>
        <input type="text" name="reason" placeholder="Motivo (opcional, ex.: dor no joelho)" maxlength="200">
        <button type="submit" class="btn btn-secondary">Excluir da minha rotação</button>
        <div class="form-msg" id="exclude-msg"></div>
      </form>
    `;

    container.querySelectorAll('.readd-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.closest('.list-row').dataset.id;
        try { await api(`/workouts/excluded-exercises/${id}`, { method: 'DELETE' }); await renderExcluded(container); }
        catch (err) { alert(err.message); }
      };
    });

    document.getElementById('exclude-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      const msg = document.getElementById('exclude-msg');
      msg.textContent = ''; msg.classList.remove('error');

      const fd = new FormData(e.target);
      try {
        await api('/workouts/excluded-exercises', {
          method: 'POST', body: JSON.stringify({ exerciseId: fd.get('exerciseId'), reason: fd.get('reason') || undefined })
        });
        await renderExcluded(container);
      } catch (err) {
        msg.textContent = err.message; msg.classList.add('error');
        submitBtn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}
