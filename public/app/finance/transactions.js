import { api } from '../api.js';
import { brl, formatDateBR, currentMonthISO, todayISO, escapeHtml } from '../format.js';

let currentMonth = currentMonthISO();
let cachedCategories = [];
let cachedAccounts = [];
let cachedCards = [];

export async function renderTransactions(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <h2 class="page-title" style="margin:0">Transações</h2>
      <input type="month" id="month-filter" value="${currentMonth}" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 10px;font-family:inherit;">
    </div>
    <div id="tx-summary" class="card" style="margin-top:14px;"></div>
    <div id="tx-list" style="margin-top:10px;"><div class="empty-state">Carregando...</div></div>

    <dialog id="tx-dialog">
      <h2>Nova transação</h2>
      <form class="form-grid" id="tx-form">
        <div><label>Descrição</label><input type="text" name="description" required maxlength="200" placeholder="Ex.: Supermercado"></div>
        <div class="form-row-2">
          <div><label>Valor (R$)</label><input type="number" name="amount" step="0.01" min="0.01" required></div>
          <div><label>Tipo</label><select name="type"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></div>
        </div>
        <div class="form-row-2">
          <div><label>Data</label><input type="date" name="dueDate" required></div>
          <div><label>Categoria</label><select name="categoryId" id="tx-category-select"><option value="">Sem categoria</option></select></div>
        </div>
        <div class="form-row-2">
          <div><label>Conta</label><select name="accountId" id="tx-account-select"><option value="">Nenhuma</option></select></div>
          <div><label>Cartão</label><select name="cardId" id="tx-card-select"><option value="">Nenhum</option></select></div>
        </div>
        <div><label>Parcelas (deixe 1 para à vista)</label><input type="number" name="installmentsTotal" min="1" max="60" value="1"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="tx-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="tx-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-tx" aria-label="Nova transação">+</button>
  `;

  document.getElementById('month-filter').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadTransactions();
  });

  const [categoriesRes, accountsRes, cardsRes] = await Promise.all([
    api('/finance/categories'), api('/finance/accounts'), api('/finance/cards')
  ]);
  cachedCategories = categoriesRes.categories;
  cachedAccounts = accountsRes.accounts;
  cachedCards = cardsRes.cards;

  document.getElementById('tx-category-select').innerHTML += cachedCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('tx-account-select').innerHTML += cachedAccounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  document.getElementById('tx-card-select').innerHTML += cachedCards.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  const dialog = document.getElementById('tx-dialog');
  const form = document.getElementById('tx-form');
  const msg = document.getElementById('tx-msg');

  document.getElementById('fab-add-tx').onclick = () => {
    form.reset();
    form.dueDate.value = todayISO();
    msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('tx-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const payload = {
      description: fd.get('description'), amount: fd.get('amount'), type: fd.get('type'),
      dueDate: fd.get('dueDate'), categoryId: fd.get('categoryId') || undefined,
      accountId: fd.get('accountId') || undefined, cardId: fd.get('cardId') || undefined,
      installmentsTotal: parseInt(fd.get('installmentsTotal'), 10) || 1
    };

    try {
      await api('/finance/transactions', { method: 'POST', body: JSON.stringify(payload) });
      dialog.close();
      await loadTransactions();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadTransactions();
}

function categoryName(id) {
  return cachedCategories.find(c => c.id === id)?.name || null;
}

async function loadTransactions() {
  const summaryEl = document.getElementById('tx-summary');
  const listEl = document.getElementById('tx-list');
  try {
    const { transactions } = await api(`/finance/transactions?month=${currentMonth}`);
    const income = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);

    summaryEl.innerHTML = `
      <div class="form-row-2">
        <div><div class="label">Receitas</div><div class="value" style="font-size:16px;color:var(--ok)">${brl(income)}</div></div>
        <div><div class="label">Despesas</div><div class="value" style="font-size:16px;color:var(--danger)">${brl(expenses)}</div></div>
      </div>`;

    listEl.innerHTML = transactions.length
      ? `<div class="card" style="padding:0">${transactions.map(txRow).join('')}</div>`
      : '<div class="empty-state">Nenhuma transação neste mês.</div>';

    attachRowHandlers(transactions);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function txRow(t) {
  const cat = categoryName(t.category_id);
  const installmentLabel = t.installment_number ? ` · ${t.installment_number}/${t.installment_total}` : '';
  return `
    <div class="list-row" data-tx="${t.transaction_id}" data-inst="${t.installment_number || ''}">
      <div class="main">
        <div class="title">${escapeHtml(t.description)}</div>
        <div class="meta">${formatDateBR(t.due_date)}${cat ? ' · ' + escapeHtml(cat) : ''}${installmentLabel} <span class="badge ${t.status}">${t.status}</span></div>
      </div>
      <div class="amount ${t.type}">${t.type === 'despesa' ? '-' : '+'}${brl(t.amount)}</div>
      <div class="row-actions">
        <button class="icon-btn delete-btn" title="Excluir"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function attachRowHandlers(transactions) {
  document.querySelectorAll('#tx-list .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const row = btn.closest('.list-row');
      const txId = row.dataset.tx;
      if (!confirm('Excluir esta transação? Se for parcelada, todas as parcelas futuras também são removidas.')) return;
      try { await api(`/finance/transactions/${txId}`, { method: 'DELETE' }); await loadTransactions(); }
      catch (err) { alert(err.message); }
    };
  });
}
