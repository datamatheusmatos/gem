import { api } from '../api.js';
import { escapeHtml } from '../format.js';

let cachedProjects = [];
let cachedTasksByProject = {};

export async function renderProjects(container) {
  container.innerHTML = `
    <div id="projects-list"><div class="empty-state">Carregando...</div></div>

    <dialog id="project-dialog">
      <h2>Novo projeto</h2>
      <form class="form-grid" id="project-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="150" placeholder="Ex.: Montar portfólio"></div>
        <div><label>Objetivo (opcional)</label><textarea name="objective" maxlength="500"></textarea></div>
        <div><label>Prazo (opcional)</label><input type="date" name="deadline"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="project-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="project-msg"></div>
      </form>
    </dialog>

    <dialog id="task-dialog">
      <h2>Nova tarefa do projeto</h2>
      <form class="form-grid" id="project-task-form">
        <div><label>Título</label><input type="text" name="title" required maxlength="200"></div>
        <div><label>Prazo (opcional)</label><input type="date" name="dueDate"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="ptask-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Adicionar</button>
        </div>
        <div class="form-msg" id="ptask-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-project" aria-label="Novo projeto">+</button>
  `;

  const dialog = document.getElementById('project-dialog');
  const form = document.getElementById('project-form');
  document.getElementById('fab-add-project').onclick = () => { form.reset(); document.getElementById('project-msg').textContent = ''; dialog.showModal(); };
  document.getElementById('project-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('project-msg');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/growth/projects', {
        method: 'POST',
        body: JSON.stringify({ name: fd.get('name'), objective: fd.get('objective') || undefined, deadline: fd.get('deadline') || undefined })
      });
      dialog.close();
      await loadProjects();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const taskDialog = document.getElementById('task-dialog');
  document.getElementById('ptask-cancel').onclick = () => taskDialog.close();

  document.getElementById('project-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const tmsg = document.getElementById('ptask-msg');
    tmsg.textContent = ''; tmsg.classList.remove('error');

    const fd = new FormData(e.target);
    const projectId = taskDialog.dataset.projectId;
    try {
      await api(`/growth/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ title: fd.get('title'), dueDate: fd.get('dueDate') || undefined })
      });
      taskDialog.close();
      await loadProjectTasks(projectId);
    } catch (err) {
      tmsg.textContent = err.message; tmsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadProjects();
}

async function loadProjects() {
  const listEl = document.getElementById('projects-list');
  try {
    const { projects } = await api('/growth/projects');
    cachedProjects = projects;
    listEl.innerHTML = projects.length ? projects.map(projectCard).join('') : '<div class="empty-state">Nenhum projeto cadastrado.</div>';
    for (const p of projects) await loadProjectTasks(p.id);
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function projectCard(p) {
  return `
    <div class="card" data-id="${p.id}">
      <div style="display:flex;justify-content:space-between;">
        <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(p.name)}</div>
        <button class="icon-btn add-task-btn" title="Adicionar tarefa"><i class="ti ti-plus"></i></button>
      </div>
      ${p.objective ? `<div class="meta">${escapeHtml(p.objective)}</div>` : ''}
      <div class="progress-bar"><div class="fill" style="width:${p.progress}%"></div></div>
      <div class="meta" style="margin-top:6px;">${p.progress}% concluído</div>
      <div class="project-tasks" id="tasks-for-${p.id}" style="margin-top:10px;"></div>
    </div>`;
}

async function loadProjectTasks(projectId) {
  const el = document.getElementById(`tasks-for-${projectId}`);
  if (!el) return;
  try {
    const { tasks } = await api(`/growth/projects/${projectId}/tasks`);
    cachedTasksByProject[projectId] = tasks;
    el.innerHTML = tasks.map(t => `
      <div class="list-row" style="padding:6px 0;" data-task-id="${t.id}" data-project-id="${projectId}">
        <div class="main"><div class="title" style="font-size:13px;${t.done ? 'text-decoration:line-through;color:var(--text-secondary);' : ''}">${escapeHtml(t.title)}</div></div>
        <input type="checkbox" class="toggle-task" ${t.done ? 'checked' : ''} style="width:auto;">
      </div>`).join('');
    el.querySelectorAll('.toggle-task').forEach(cb => {
      cb.onchange = async (e) => {
        const row = e.target.closest('.list-row');
        try {
          await api(`/growth/projects/${row.dataset.projectId}/tasks/${row.dataset.taskId}`, {
            method: 'PATCH', body: JSON.stringify({ done: e.target.checked })
          });
          await loadProjects();
        } catch (err) {
          alert(err.message);
        }
      };
    });
  } catch {
    el.innerHTML = '';
  }
}

function attachHandlers() {
  document.querySelectorAll('#projects-list .add-task-btn').forEach(btn => {
    btn.onclick = () => {
      const projectId = btn.closest('.card').dataset.id;
      const dialog = document.getElementById('task-dialog');
      dialog.dataset.projectId = projectId;
      document.getElementById('project-task-form').reset();
      document.getElementById('ptask-msg').textContent = '';
      dialog.showModal();
    };
  });
}
