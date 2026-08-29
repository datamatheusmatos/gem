import { api } from '../api.js';
import { brl, escapeHtml } from '../format.js';

export async function renderCards(container) {
  container.innerHTML = `
    <h2 class="page-title">Cartões</h2>
    <div id="cards-list" style="margin-top:16px"><div class="empty-state">Carregando...</div></div>

    <dialog id="card-dialog">
      <h2 id="card-dialog-title">Novo cartão</h2>
      <form class="form-grid" id="card-form">
        <input type="hidden" name="id">
        <div><label>Nome</label><input type="text" name="name" required maxlength="120" placeholder="Ex.: Nubank"></div>
        <div class="form-row-2">
          <div><label>Banco</label><input type="text" name="bank" maxlength="120"></div>
          <div><label>Bandeira</label><input type="text" name="brand" maxlength="60"></div>
        </div>
        <div><label>Limite total (R$)</label><input type="number" name="limit" step="0.01" min="0" required></div>
        <div class="form-row-2">
          <div><label>Dia de fechamento</label><input type="number" name="closingDay" min="1" max="31" required></div>
          <div><label>Dia de vencimento</label><input type="number" name="dueDay" min="1" max="31" required></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="card-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="card-msg"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-card" aria-label="Novo cartão">+</button>
  `;

  const dialog = document.getElementById('card-dialog');
  const form = document.getElementById('card-form');
  const msg = document.getElementById('card-msg');

  document.getElementById('fab-add-card').onclick = () => {
    form.reset(); form.id.value = '';
    document.getElementById('card-dialog-title').textContent = 'Novo cartão';
    msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('card-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const id = fd.get('id');
    const payload = {
      name: fd.get('name'), bank: fd.get('bank') || undefined, brand: fd.get('brand') || undefined,
      limit: fd.get('limit'), closingDay: parseInt(fd.get('closingDay'), 10), dueDay: parseInt(fd.get('dueDay'), 10)
    };

    try {
      if (id) await api(`/finance/cards/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/finance/cards', { method: 'POST', body: JSON.stringify(payload) });
      dialog.close();
      await loadCards();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadCards();
}

let cachedCards = [];

async function loadCards() {
  const listEl = document.getElementById('cards-list');
  try {
    const { cards } = await api('/finance/cards');
    cachedCards = cards;
    listEl.innerHTML = cards.length ? cards.map(cardCard).join('') : '<div class="empty-state">Nenhum cartão cadastrado ainda.</div>';
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function cardCard(c) {
  const percentCommitted = c.limit > 0 ? Math.min(Math.round((c.committed / c.limit) * 100), 100) : 0;
  return `
    <div class="card" data-id="${c.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(c.name)}</div>
          <div class="meta" style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(c.bank || '')} ${c.bank && c.brand ? '·' : ''} ${escapeHtml(c.brand || '')}</div>
        </div>
        <div class="row-actions">
          <button class="icon-btn edit-btn" title="Editar"><i class="ti ti-pencil"></i></button>
          <button class="icon-btn delete-btn" title="Excluir"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      <div style="margin-top:10px;font-size:13px;">Comprometido: <strong>${brl(c.committed)}</strong> de ${brl(c.limit)}</div>
      <div class="progress-bar"><div class="fill ${percentCommitted >= 90 ? 'over' : ''}" style="width:${percentCommitted}%"></div></div>
      <div class="meta" style="margin-top:8px;">Fecha dia ${c.closingDay} · Vence dia ${c.dueDay}</div>
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll('#cards-list .edit-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.card').dataset.id;
      const c = cachedCards.find(x => x.id === id);
      const form = document.getElementById('card-form');
      form.id.value = c.id; form.name.value = c.name; form.bank.value = c.bank || '';
      form.brand.value = c.brand || ''; form.limit.value = c.limit; form.closingDay.value = c.closingDay; form.dueDay.value = c.dueDay;
      document.getElementById('card-dialog-title').textContent = 'Editar cartão';
      document.getElementById('card-msg').textContent = '';
      document.getElementById('card-dialog').showModal();
    };
  });
  document.querySelectorAll('#cards-list .delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.closest('.card').dataset.id;
      const c = cachedCards.find(x => x.id === id);
      if (!confirm(`Excluir o cartão "${c.name}"?`)) return;
      try { await api(`/finance/cards/${id}`, { method: 'DELETE' }); await loadCards(); }
      catch (err) { alert(err.message); }
    };
  });
}
