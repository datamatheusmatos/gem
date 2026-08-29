import { api } from '../api.js';
import { brl, currentMonthISO, escapeHtml } from '../format.js';

let currentMonth = currentMonthISO();
let cachedCategories = [];

export async function renderBudgets(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <h2 class="page-title" style="margin:0">Orçamento</h2>
      <input type="month" id="budget-month-filter" value="${currentMonth}" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-family:inherit;">
    </div>
    <div id="budgets-list" style="margin-top:16px;"><div class="empty-state">Carregando...</div></div>

    <dialog id="budget-dialog">
      <h2>Definir orçamento</h2>
      <form class="form-grid" id="budget-form">
        <div><label>Categoria</label><select name="categoryId" id="budget-category-select" required></select></div>
        <div><label>Valor planejado (R$)</label><input type="number" name="planned" step="0.01" min="0" required></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="budget-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="budget-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-budget" aria-label="Definir orçamento">+</button>
  `;

  document.getElementById('budget-month-filter').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadBudgets();
  });

  const { categories } = await api('/finance/categories');
  cachedCategories = categories.filter(c => c.kind === 'despesa');
  document.getElementById('budget-category-select').innerHTML =
    cachedCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const dialog = document.getElementById('budget-dialog');
  const form = document.getElementById('budget-form');
  const msg = document.getElementById('budget-msg');

  document.getElementById('fab-add-budget').onclick = () => {
    form.reset(); msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('budget-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    try {
      await api('/finance/budgets', {
        method: 'POST',
        body: JSON.stringify({ categoryId: fd.get('categoryId'), period: currentMonth, planned: fd.get('planned') })
      });
      dialog.close();
      await loadBudgets();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadBudgets();
}

async function loadBudgets() {
  const listEl = document.getElementById('budgets-list');
  try {
    const { budgets } = await api(`/finance/budgets?period=${currentMonth}`);
    listEl.innerHTML = budgets.length ? budgets.map(budgetCard).join('') : '<div class="empty-state">Nenhum orçamento definido para este mês. Toque em + para começar.</div>';
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function budgetCard(b) {
  if (b.noLimitDefined) {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;">
          <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(b.category_name)}</div>
          <span class="badge critico">sem limite definido</span>
        </div>
        <div class="meta" style="margin-top:6px;">Você já gastou ${brl(b.realized)} nesta categoria, mas ainda não definiu um valor planejado.</div>
      </div>`;
  }
  const percent = b.percent_used ?? 0;
  const over = percent >= 100;
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;">
        <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(b.category_name)}</div>
        <div style="font-size:13px;color:${over ? 'var(--danger)' : 'var(--text-secondary)'}">${percent}%</div>
      </div>
      <div class="progress-bar"><div class="fill ${over ? 'over' : ''}" style="width:${Math.min(percent, 100)}%"></div></div>
      <div class="meta" style="margin-top:6px;">${brl(b.realized)} de ${brl(b.planned)} ${b.remaining >= 0 ? `· restam ${brl(b.remaining)}` : `· estourou em ${brl(-b.remaining)}`}</div>
    </div>`;
}
