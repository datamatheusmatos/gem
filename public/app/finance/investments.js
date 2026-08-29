import { api } from '../api.js';
import { brl, todayISO, escapeHtml } from '../format.js';

const CATEGORY_LABELS = { renda_fixa: 'Renda fixa', fundos: 'Fundos', acoes: 'Ações', etf: 'ETFs', cripto: 'Criptomoedas', outros: 'Outros' };

let cachedInvestments = [];

export async function renderInvestments(container) {
  container.innerHTML = `
    <h2 class="page-title">Investimentos</h2>
    <div id="inv-summary" class="card" style="margin-top:14px;"></div>
    <div id="inv-list" style="margin-top:10px;"><div class="empty-state">Carregando...</div></div>

    <dialog id="inv-dialog">
      <h2>Novo investimento</h2>
      <form class="form-grid" id="inv-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="120" placeholder="Ex.: Tesouro Selic 2029"></div>
        <div><label>Categoria</label>
          <select name="category" required>
            ${Object.entries(CATEGORY_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div><label>Instituição</label><input type="text" name="institution" maxlength="120"></div>
        <div class="form-row-2">
          <div><label>Quantidade</label><input type="number" name="quantity" step="0.0001" value="0"></div>
          <div><label>Preço médio (R$)</label><input type="number" name="avgPrice" step="0.01" value="0"></div>
        </div>
        <div><label>Valor atual (R$)</label><input type="number" name="currentValue" step="0.01" value="0"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="inv-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="inv-msg"></div>
      </form>
    </dialog>

    <dialog id="movement-dialog">
      <h2>Registrar aporte/resgate</h2>
      <form class="form-grid" id="movement-form">
        <div><label>Tipo</label><select name="type"><option value="aporte">Aporte</option><option value="resgate">Resgate</option></select></div>
        <div><label>Valor (R$)</label><input type="number" name="amount" step="0.01" min="0.01" required></div>
        <div><label>Quantidade (opcional)</label><input type="number" name="quantity" step="0.0001"></div>
        <div><label>Data</label><input type="date" name="date" required></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="movement-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
        <div class="form-msg" id="movement-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-inv" aria-label="Novo investimento">+</button>
  `;

  const dialog = document.getElementById('inv-dialog');
  const form = document.getElementById('inv-form');
  const msg = document.getElementById('inv-msg');

  document.getElementById('fab-add-inv').onclick = () => {
    form.reset(); msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('inv-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const payload = {
      name: fd.get('name'), category: fd.get('category'), institution: fd.get('institution') || undefined,
      quantity: parseFloat(fd.get('quantity')) || 0, avgPrice: fd.get('avgPrice') || 0, currentValue: fd.get('currentValue') || 0
    };

    try {
      await api('/investments', { method: 'POST', body: JSON.stringify(payload) });
      dialog.close();
      await loadInvestments();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const movementDialog = document.getElementById('movement-dialog');
  document.getElementById('movement-cancel').onclick = () => movementDialog.close();

  document.getElementById('movement-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const mmsg = document.getElementById('movement-msg');
    mmsg.textContent = ''; mmsg.classList.remove('error');

    const fd = new FormData(e.target);
    const invId = movementDialog.dataset.invId;
    try {
      await api(`/investments/${invId}/movements`, {
        method: 'POST',
        body: JSON.stringify({ type: fd.get('type'), amount: fd.get('amount'), quantity: parseFloat(fd.get('quantity')) || undefined, date: fd.get('date') })
      });
      movementDialog.close();
      await loadInvestments();
    } catch (err) {
      mmsg.textContent = err.message; mmsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadInvestments();
}

async function loadInvestments() {
  const summaryEl = document.getElementById('inv-summary');
  const listEl = document.getElementById('inv-list');
  try {
    const { investments } = await api('/investments');
    cachedInvestments = investments;
    const total = investments.reduce((s, i) => s + i.currentValue, 0);
    summaryEl.innerHTML = `<div class="label">Patrimônio investido</div><div class="value">${brl(total)}</div>`;
    listEl.innerHTML = investments.length ? investments.map(invCard).join('') : '<div class="empty-state">Nenhum investimento cadastrado.</div>';
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function invCard(i) {
  return `
    <div class="card" data-id="${i.id}">
      <div style="display:flex;justify-content:space-between;">
        <div>
          <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(i.name)}</div>
          <div class="meta">${CATEGORY_LABELS[i.category] || i.category}${i.institution ? ' · ' + escapeHtml(i.institution) : ''}</div>
        </div>
        <button class="icon-btn move-btn" title="Aporte/resgate"><i class="ti ti-transfer"></i></button>
      </div>
      <div style="margin-top:8px;font-size:15px;font-weight:600;">${brl(i.currentValue)}</div>
      <div class="meta">${i.quantity} unid. · preço médio ${brl(i.avgPrice)}</div>
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll('#inv-list .move-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.card').dataset.id;
      const dialog = document.getElementById('movement-dialog');
      dialog.dataset.invId = id;
      document.getElementById('movement-form').reset();
      document.getElementById('movement-form').date.value = todayISO();
      document.getElementById('movement-msg').textContent = '';
      dialog.showModal();
    };
  });
}
