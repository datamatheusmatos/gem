import { api } from '../api.js';
import { brl, escapeHtml } from '../format.js';

let cachedDebts = [];

export async function renderDebts(container) {
  container.innerHTML = `
    <h2 class="page-title">Financiamentos e dívidas</h2>
    <div id="debts-list" style="margin-top:16px;"><div class="empty-state">Carregando...</div></div>

    <dialog id="debt-dialog">
      <h2>Nova dívida</h2>
      <form class="form-grid" id="debt-form">
        <div><label>Nome</label><input type="text" name="name" required maxlength="120" placeholder="Ex.: Financiamento do carro"></div>
        <div><label>Instituição</label><input type="text" name="institution" maxlength="120"></div>
        <div class="form-row-2">
          <div><label>Valor original (R$)</label><input type="number" name="originalAmount" step="0.01" min="0.01" required></div>
          <div><label>Valor da parcela (R$)</label><input type="number" name="installmentAmount" step="0.01" min="0.01" required></div>
        </div>
        <div class="form-row-2">
          <div><label>Quantidade de parcelas</label><input type="number" name="installmentsTotal" min="1" required></div>
          <div><label>Taxa mensal (ex.: 0.015 = 1,5%)</label><input type="number" name="rateMonthly" step="0.0001" min="0" value="0"></div>
        </div>
        <div class="form-row-2">
          <div><label>Data de início</label><input type="date" name="startDate" required></div>
          <div><label>Dia de vencimento</label><input type="number" name="dueDay" min="1" max="31" required></div>
        </div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="debt-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
        <div class="form-msg" id="debt-msg"></div>
      </form>
    </dialog>

    <dialog id="payment-dialog">
      <h2>Registrar pagamento</h2>
      <form class="form-grid" id="payment-form">
        <div><label>Valor pago (R$)</label><input type="number" name="amount" step="0.01" min="0.01" required></div>
        <div class="form-row-2">
          <div><label>Amortização/principal (R$)</label><input type="number" name="principal" step="0.01" min="0" required></div>
          <div><label>Juros (R$)</label><input type="number" name="interest" step="0.01" min="0" value="0"></div>
        </div>
        <div><label>Data</label><input type="date" name="paidDate" required></div>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text);"><input type="checkbox" name="isExtra" style="width:auto;"> Pagamento extra (antecipação)</label>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="payment-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">Registrar</button>
        </div>
        <div class="form-msg" id="payment-msg"></div>
      </form>
    </dialog>

    <dialog id="whatif-dialog">
      <h2>E se eu antecipar um pagamento?</h2>
      <form class="form-grid" id="whatif-form">
        <div><label>Valor extra (R$)</label><input type="number" name="extraPayment" step="0.01" min="0.01"></div>
        <div><label>Ou parcelas extras (quantidade)</label><input type="number" name="extraInstallments" min="0" value="0"></div>
        <div class="row">
          <button type="button" class="btn btn-secondary" id="whatif-cancel">Fechar</button>
          <button type="submit" class="btn btn-primary">Simular</button>
        </div>
        <div class="form-msg" id="whatif-msg"></div>
        <div id="whatif-result"></div>
      </form>
    </dialog>

    <button class="fab" id="fab-add-debt" aria-label="Nova dívida">+</button>
  `;

  const dialog = document.getElementById('debt-dialog');
  const form = document.getElementById('debt-form');
  const msg = document.getElementById('debt-msg');

  document.getElementById('fab-add-debt').onclick = () => {
    form.reset(); msg.textContent = '';
    dialog.showModal();
  };
  document.getElementById('debt-cancel').onclick = () => dialog.close();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(form);
    const payload = {
      name: fd.get('name'), institution: fd.get('institution') || undefined,
      originalAmount: fd.get('originalAmount'), installmentAmount: fd.get('installmentAmount'),
      installmentsTotal: parseInt(fd.get('installmentsTotal'), 10), rateMonthly: parseFloat(fd.get('rateMonthly')) || 0,
      startDate: fd.get('startDate'), dueDay: parseInt(fd.get('dueDay'), 10)
    };

    try {
      await api('/debts', { method: 'POST', body: JSON.stringify(payload) });
      dialog.close();
      await loadDebts();
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const paymentDialog = document.getElementById('payment-dialog');
  document.getElementById('payment-cancel').onclick = () => paymentDialog.close();

  document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const pmsg = document.getElementById('payment-msg');
    pmsg.textContent = ''; pmsg.classList.remove('error');

    const fd = new FormData(e.target);
    const debtId = paymentDialog.dataset.debtId;
    try {
      await api(`/debts/${debtId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: fd.get('amount'), principal: fd.get('principal'), interest: fd.get('interest') || 0,
          paidDate: fd.get('paidDate'), isExtra: fd.get('isExtra') === 'on'
        })
      });
      paymentDialog.close();
      await loadDebts();
    } catch (err) {
      pmsg.textContent = err.message; pmsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  const whatifDialog = document.getElementById('whatif-dialog');
  document.getElementById('whatif-cancel').onclick = () => whatifDialog.close();

  document.getElementById('whatif-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const wmsg = document.getElementById('whatif-msg');
    const resultEl = document.getElementById('whatif-result');
    wmsg.textContent = ''; wmsg.classList.remove('error');

    const fd = new FormData(e.target);
    const debtId = whatifDialog.dataset.debtId;
    try {
      const result = await api(`/debts/${debtId}/simulate-payoff`, {
        method: 'POST',
        body: JSON.stringify({
          extraPayment: fd.get('extraPayment') || undefined,
          extraInstallments: parseInt(fd.get('extraInstallments'), 10) || 0
        })
      });
      resultEl.innerHTML = `
        <div class="card raised" style="margin-top:10px;">
          <div class="meta">Estimativa — não é garantia</div>
          <div style="font-size:14px;margin-top:6px;">Economiza <strong>${result.monthsSaved} meses</strong>, restando ${result.newMonthsRemaining} parcelas.</div>
          <div style="font-size:14px;margin-top:4px;">Juros estimados economizados: <strong>R$ ${result.estimatedInterestSaved.toFixed(2)}</strong></div>
        </div>`;
    } catch (err) {
      wmsg.textContent = err.message; wmsg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadDebts();
}

async function loadDebts() {
  const listEl = document.getElementById('debts-list');
  try {
    const { debts } = await api('/debts');
    cachedDebts = debts;
    listEl.innerHTML = debts.length ? debts.map(debtCard).join('') : '<div class="empty-state">Nenhuma dívida cadastrada.</div>';
    attachHandlers();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function debtCard(d) {
  const percent = Math.round((d.installmentsPaid / d.installmentsTotal) * 100);
  return `
    <div class="card" data-id="${d.id}">
      <div style="display:flex;justify-content:space-between;">
        <div class="title" style="font-size:14px;font-weight:500;">${escapeHtml(d.name)}</div>
        <div class="row-actions">
          <button class="icon-btn whatif-btn" title="Simular antecipação"><i class="ti ti-calculator"></i></button>
          <button class="icon-btn pay-btn" title="Registrar pagamento"><i class="ti ti-cash"></i></button>
        </div>
      </div>
      <div class="meta">${escapeHtml(d.institution || '')}</div>
      <div style="margin-top:8px;font-size:13px;">Saldo devedor: <strong>${brl(d.remainingAmount)}</strong></div>
      <div class="progress-bar"><div class="fill" style="width:${percent}%"></div></div>
      <div class="meta" style="margin-top:6px;">${d.installmentsPaid}/${d.installmentsTotal} parcelas pagas · ${brl(d.installmentAmount)}/mês</div>
    </div>`;
}

function attachHandlers() {
  document.querySelectorAll('#debts-list .pay-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.card').dataset.id;
      const debt = cachedDebts.find(d => d.id === id);
      const dialog = document.getElementById('payment-dialog');
      dialog.dataset.debtId = id;
      document.getElementById('payment-form').reset();
      document.getElementById('payment-form').amount.value = debt.installmentAmount;
      document.getElementById('payment-form').principal.value = debt.installmentAmount;
      document.getElementById('payment-msg').textContent = '';
      dialog.showModal();
    };
  });
  document.querySelectorAll('#debts-list .whatif-btn').forEach(btn => {
    btn.onclick = () => {
      const id = btn.closest('.card').dataset.id;
      const dialog = document.getElementById('whatif-dialog');
      dialog.dataset.debtId = id;
      document.getElementById('whatif-form').reset();
      document.getElementById('whatif-msg').textContent = '';
      document.getElementById('whatif-result').innerHTML = '';
      dialog.showModal();
    };
  });
}
