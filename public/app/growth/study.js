import { api } from '../api.js';
import { todayISO, escapeHtml } from '../format.js';

let cachedItems = [];

export async function renderStudy(container) {
  container.innerHTML = `
    <div id="study-list"><div class="empty-state">Carregando...</div></div>

    <dialog id="study-dialog">
      <h2>Novo item de estudo</h2>
      <form class="form-grid" id="study-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="150" placeholder="Ex.: Curso de Rust"></div>
        <div><label>Instituição (opcional)</label><input type="text" name="institution" maxlength="150"></div>
        <div class="form-row-2">
          <div><label>Carga horária total (horas)</label><input type="number" name="totalHours" step="0.5" min="0.5"></div>
          <div><label>Prazo (opcional)</label><input type="date" name="deadline"></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="study-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="study-msg"></div>
      </form>
    </dialog>

    <dialog id="session-dialog">
      <h2>Registrar sessão de estudo</h2>
      <form class="form-grid" id="session-form">
        <div><label>Duração (minutos)</label><input type="number" name="minutes" min="1" required></div>
        <div><label>Data</label><input type="date" name="date" required></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="session-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
        <div class="form-msg" id="session-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-study" aria-label="Novo item de estudo">+</button>
  `;

  const dialog = document.getElementById('study-dialog');
  const form = document.getElementById('study-form');
  document.getElementById('fab-add-study').onclick = () => { form.reset(); document.getElementById('study-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('study-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('study-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/growth/study', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'), institution: fd.get('institution') || undefined,
          totalHours: fd.get('totalHours') ? parseFloat(fd.get('totalHours')) : undefined,
          deadline: fd.get('deadline') || undefined
        })
      });
      dialog.close();
      await loadStudy();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const sessionDialog = document.getElementById('session-dialog');
  document.getElementById('session-cancel').onclick = () => sessionDialog.close();

  document.getElementById('session-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const smsg = document.getElementById('session-msg');
    smsg.textContent = ''; smsg.classList.remove('error');

    const fd = new FormData(e.target);
    const itemId = sessionDialog.dataset.itemId;
    try {
      await api(`/growth/study/${itemId}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ minutes: parseInt(fd.get('minutes'), 10), date: fd.get('date') })
      });
      sessionDialog.close();
      await loadStudy();
    } catch (err) {
      smsg.textContent = err.message; smsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadStudy();
}

async function loadStudy() {
  const listEl = document.getElementById('study-list');
  try {
    const { items } = await api('/growth/study');
    cachedItems = items;
    listEl.innerHTML = items.length ? items.map(studyCard).join('') : '<div class="empty-state">Nenhum item de estudo cadastrado.</div>';
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function studyCard(item) {
  const percent = item.total_hours ? Math.min(Math.round((item.hours_done / item.total_hours) * 100), 100) : 0;
  const exceeded = item.total_hours && item.hours_done > item.total_hours;
  return `
    <div class="card" data-id="${item.id}">
      <div style="display:flex;justify-content:space-between;">
        <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(item.name)}</div>
        <button class="icon-btn log-session-btn" title="Registrar sessão"><i class="ti ti-clock-plus"></i></button>
      </div>
      <div class="meta">${escapeHtml(item.institution || '')}</div>
      ${item.total_hours ? `
        <div style="margin-top:8px;font-size:13px;">${exceeded ? `${item.hours_done}h estudadas — superou a carga prevista de ${item.total_hours}h` : `${item.hours_done}h de ${item.total_hours}h`}</div>
        <div class="progress-bar"><div class="fill" style="width:${percent}%"></div></div>
      ` : `<div style="margin-top:8px;font-size:13px;">${item.hours_done}h estudadas</div>`}
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll('#study-list .log-session-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.card').dataset.id;
      const dialog = document.getElementById('session-dialog');
      dialog.dataset.itemId = id;
      document.getElementById('session-form').reset();
      document.getElementById('session-form').date.value = todayISO();
      document.getElementById('session-msg').textContent = '';
      dialog.showModal();
    };
  });
}
