import { api } from '../api.js';
import { brl, escapeHtml } from '../format.js';

const TYPE_LABELS = { corrente: 'Conta corrente', poupanca: 'Poupança', carteira: 'Carteira', digital: 'Conta digital', investimento: 'Investimento', outros: 'Outros' };

export async function renderAccounts(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2 class="page-title" style="margin:0">Contas</h2>
      <button class="btn btn-secondary" id="btn-transfer">Transferir</button>
    </div>
    <div id="accounts-list" style="margin-top:16px"><div class="empty-state">Carregando...</div></div>

    <dialog id="account-dialog">
      <h2 id="account-dialog-title">Nova conta</h2>
      <form class="form-grid" id="account-form">
        <input type="hidden" name="id">
        <div><label>Nome</label><input type="text" name="name" required maxlength="120" placeholder="Ex.: Conta Corrente Itaú"></div>
        <div><label>Tipo</label>
          <select name="type" required>
            ${Object.entries(TYPE_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div><label>Saldo inicial (R$)</label><input type="number" name="balance" step="0.01" value="0"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="account-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="account-msg"></div>
      </form>
    </dialog>

    <dialog id="transfer-dialog">
      <h2>Transferir entre contas</h2>
      <form class="form-grid" id="transfer-form">
        <div><label>De</label><select name="fromAccountId" id="transfer-from" required></select></div>
        <div><label>Para</label><select name="toAccountId" id="transfer-to" required></select></div>
        <div><label>Valor (R$)</label><input type="number" name="amount" step="0.01" min="0.01" required></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="transfer-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Transferir</button>
        </div>
        <div class="form-msg" id="transfer-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-account" aria-label="Nova conta">+</button>
  `;

  const dialog = document.getElementById('account-dialog');
  const form = document.getElementById('account-form');
  const msg = document.getElementById('account-msg');

  document.getElementById('fab-add-account').onclick = () => {
    form.reset();
    form.id.value = '';
    document.getElementById('account-dialog-title').textContent = 'Nova conta';
    msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('account-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const id = fd.get('id');
    const payload = { name: fd.get('name'), type: fd.get('type'), balance: fd.get('balance') || 0 };

    try {
      if (id) {
        await api(`/finance/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/finance/accounts', { method: 'POST', body: JSON.stringify(payload) });
      }
      dialog.close();
      await loadAccounts();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const transferDialog = document.getElementById('transfer-dialog');
  document.getElementById('btn-transfer').onclick = async () => {
    await populateTransferSelects();
    document.getElementById('transfer-msg').textContent = '';
    transferDialog.showModal();
  };
  document.getElementById('transfer-cancel').onclick = () => transferDialog.close();

  document.getElementById('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const tmsg = document.getElementById('transfer-msg');
    tmsg.textContent = ''; tmsg.classList.remove('error');

    const fd = new FormData(e.target);
    try {
      await api('/finance/transfers', {
        method: 'POST',
        body: JSON.stringify({ fromAccountId: fd.get('fromAccountId'), toAccountId: fd.get('toAccountId'), amount: fd.get('amount') })
      });
      transferDialog.close();
      await loadAccounts();
    } catch (err) {
      tmsg.textContent = err.message; tmsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadAccounts();
}

let cachedAccounts = [];

async function loadAccounts() {
  const listEl = document.getElementById('accounts-list');
  try {
    const { accounts } = await api('/finance/accounts');
    cachedAccounts = accounts;
    listEl.innerHTML = accounts.length ? `<div class="card" style="padding:0">${accounts.map(accountRow).join('')}</div>` : '<div class="empty-state">Nenhuma conta cadastrada ainda. Toque em + para criar a primeira.</div>';
    attachRowHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function accountRow(a) {
  return `
    <div class="list-row" data-id="${a.id}">
      <div class="main">
        <div class="title">${escapeHtml(a.name)}</div>
        <div class="meta">${TYPE_LABELS[a.type] || a.type}</div>
      </div>
      <div class="amount">${brl(a.balance)}</div>
      <div class="row-actions">
        <button class="icon-btn edit-btn" aria-label="Editar" title="Editar"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn delete-btn" aria-label="Excluir" title="Excluir"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function attachRowHandlers() {
  document.querySelectorAll('#accounts-list .edit-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.list-row').dataset.id;
      const account = cachedAccounts.find(a => a.id === id);
      const form = document.getElementById('account-form');
      form.id.value = account.id;
      form.name.value = account.name;
      form.type.value = account.type;
      form.balance.value = account.balance;
      document.getElementById('account-dialog-title').textContent = 'Editar conta';
      document.getElementById('account-msg').textContent = '';
      document.getElementById('account-dialog').showModal();
    };
  });
  document.querySelectorAll('#accounts-list .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.closest('.list-row').dataset.id;
      const account = cachedAccounts.find(a => a.id === id);
      if (!confirm(`Excluir a conta "${account.name}"? O histórico de transações é mantido, só a conta deixa de aparecer nas listagens.`)) return;
      try {
        await api(`/finance/accounts/${id}`, { method: 'DELETE' });
        await loadAccounts();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

async function populateTransferSelects() {
  const { accounts } = await api('/finance/accounts');
  const options = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${brl(a.balance)})</option>`).join('');
  document.getElementById('transfer-from').innerHTML = options;
  document.getElementById('transfer-to').innerHTML = options;
}
