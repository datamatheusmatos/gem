import { api } from '../api.js';
import { todayISO, escapeHtml } from '../format.js';

const FREQ_LABELS = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' };

export async function renderHabits(container) {
  container.innerHTML = `
    <div id="habits-list"><div class="empty-state">Carregando...</div></div>

    <dialog id="habit-dialog">
      <h2>Novo hábito</h2>
      <form class="form-grid" id="habit-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="150" placeholder="Ex.: Meditar"></div>
        <div><label>Frequência</label>
          <select name="frequency">
            <option value="diario">Diário</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="habit-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="habit-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-habit" aria-label="Novo hábito">+</button>
  `;

  const dialog = document.getElementById('habit-dialog');
  const form = document.getElementById('habit-form');
  document.getElementById('fab-add-habit').onclick = () => { form.reset(); document.getElementById('habit-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('habit-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('habit-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/growth/habits', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), frequency: fd.get('frequency') }) });
      dialog.close();
      await loadHabits();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadHabits();
}

async function loadHabits() {
  const listEl = document.getElementById('habits-list');
  try {
    const { habits } = await api('/growth/habits');
    if (habits.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Nenhum hábito cadastrado.</div>';
      return;
    }

    const start = new Date(); start.setDate(start.getDate() - 27);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = todayISO();

    const withStats = await Promise.all(habits.map(async h => {
      const { logs, streak, complianceRate } = await api(`/growth/habits/${h.id}/logs?start=${startISO}&end=${endISO}`);
      const doneToday = logs.some(l => l.date === endISO && l.done);
      return { ...h, streak, complianceRate, doneToday };
    }));

    listEl.innerHTML = withStats.map(habitCard).join('');
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function habitCard(h) {
  return `
    <div class="card" data-id="${h.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(h.name)}</div>
          <div class="meta">${FREQ_LABELS[h.frequency]} · sequência: ${h.streak} · cumprimento: ${h.complianceRate}%</div>
        </div>
        <button class="btn ${h.doneToday ? 'btn-primary' : 'btn-secondary'} toggle-habit-btn" style="padding:8px 14px;">${h.doneToday ? '✓ Feito hoje' : 'Marcar hoje'}</button>
      </div>
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll('#habits-list .toggle-habit-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.closest('.card').dataset.id;
      const isDone = btn.textContent.includes('✓');
      try {
        await api(`/growth/habits/${id}/logs`, { method: 'POST', body: JSON.stringify({ date: todayISO(), done: !isDone }) });
        await loadHabits();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}
