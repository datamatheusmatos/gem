import { api } from '../api.js';
import { brl } from '../format.js';

const VERDICT_LABELS = {
  segura: { label: 'Compra segura', className: 'ativa', text: 'Essa compra cabe no seu planejamento.' },
  atencao: { label: 'Compra de atenção', className: 'pendente', text: 'Cabe no mês atual, mas reduz sua margem.' },
  nao_recomendada: { label: 'Compra não recomendada', className: 'critico', text: 'Comprometeria seu planejamento.' }
};

export async function renderSimulator(container) {
  container.innerHTML = `
    <h2 class="page-title">Posso comprar?</h2>
    <p class="page-subtitle">Simule uma compra antes de fazer — nada aqui é salvo, é só uma projeção.</p>

    <form class="form-grid" id="sim-form">
      <div><label>Valor da compra (R$)</label><input type="number" name="amount" step="0.01" min="0.01" required></div>
      <div><label>Parcelas (deixe 1 para à vista)</label><input type="number" name="installments" min="1" max="60" value="1"></div>
      <button type="submit" class="btn btn-primary btn-block">Simular</button>
      <div class="form-msg" id="sim-msg"></div>
    </form>

    <div id="sim-result" style="margin-top:18px;"></div>
  `;

  document.getElementById('sim-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const msg = document.getElementById('sim-msg');
    const resultEl = document.getElementById('sim-result');
    msg.textContent = ''; msg.classList.remove('error');

    const fd = new FormData(e.target);
    try {
      const result = await api('/engine/simulate-purchase', {
        method: 'POST',
        body: JSON.stringify({ amount: fd.get('amount'), installments: parseInt(fd.get('installments'), 10) || 1 })
      });
      const v = VERDICT_LABELS[result.verdict];
      resultEl.innerHTML = `
        <div class="card raised">
          <span class="badge ${v.className}">${v.label}</span>
          <p style="margin:10px 0 0;font-size:13.5px;line-height:1.5;">${v.text}</p>
          <div class="form-row-2" style="margin-top:14px;">
            <div><div class="label">Impacto mensal</div><div class="value" style="font-size:16px;">${brl(result.impact.monthlyImpact)}</div></div>
            <div><div class="label">Margem restante</div><div class="value" style="font-size:16px;">${brl(result.impact.remainingAfter)}</div></div>
          </div>
          ${result.impact.monthsAffected > 1 ? `<p class="page-subtitle" style="margin-top:10px;">Afeta ${result.impact.monthsAffected} meses (parcelamento).</p>` : ''}
        </div>`;
    } catch (err) {
      msg.textContent = err.message; msg.classList.add('error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
