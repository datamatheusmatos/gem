import { api } from '../api.js';
import { todayISO } from '../format.js';

// Estado acumulado ao longo das etapas — só é enviado à API quando o passo
// correspondente é confirmado, nunca tudo de uma vez (seção 58: "não fazer
// dezenas de perguntas de uma vez, utilizar etapas, mostrar progresso").
const STEPS = ['boas-vindas', 'renda', 'despesas-fixas', 'dividas', 'reserva-metas', 'rotina', 'desenvolvimento', 'concluido'];
let currentStepIndex = 0;

export async function renderOnboarding(container) {
  // Reinicia sempre do começo: a rota é acessada tanto no primeiro acesso
  // quanto, depois, por um link em Configurações para refazer a entrevista.
  currentStepIndex = 0;
  renderStep(container);
}

function renderStep(container) {
  const step = STEPS[currentStepIndex];
  const progress = Math.round((currentStepIndex / (STEPS.length - 1)) * 100);

  container.innerHTML = `
    <div style="max-width:480px;margin:0 auto;">
      ${step !== 'boas-vindas' && step !== 'concluido' ? `
        <div class="progress-bar" style="margin-bottom:20px;"><div class="fill" style="width:${progress}%"></div></div>
      ` : ''}
      <div id="onboarding-step-content"></div>
    </div>
  `;

  const content = document.getElementById('onboarding-step-content');
  const renderers = {
    'boas-vindas': renderWelcome, 'renda': renderIncome, 'despesas-fixas': renderFixedExpenses,
    'dividas': renderDebts, 'reserva-metas': renderReserveAndGoals, 'rotina': renderRoutine,
    'desenvolvimento': renderDevelopment, 'concluido': renderDone
  };
  renderers[step](content, container);
}

function goToNextStep(container) {
  currentStepIndex++;
  renderStep(container);
}

function stepButtons(container, { onNext, nextLabel = 'Continuar', showSkip = true }) {
  return `
    <div class="row" style="margin-top:18px;">
      ${showSkip ? '<button type="button" class="btn btn-secondary" id="onb-skip">Pular</button>' : ''}
      <button type="button" class="btn btn-primary" id="onb-next">${nextLabel}</button>
    </div>
    <div class="form-msg" id="onb-msg"></div>
  `;
}

function renderWelcome(content, container) {
  content.innerHTML = `
    <div class="card raised" style="text-align:center;">
      <h1 class="page-title">Bem-vindo ao Gem</h1>
      <p class="page-subtitle">Vamos configurar o básico em algumas etapas rápidas — leva menos de 3 minutos, e você pode pular qualquer parte.</p>
      <button class="btn btn-primary btn-block" id="onb-start" style="margin-top:16px;">Começar</button>
      <button class="btn btn-secondary btn-block" id="onb-skip-all" style="margin-top:8px;">Pular tudo e começar do zero</button>
    </div>
  `;
  document.getElementById('onb-start').onclick = () => goToNextStep(container);
  document.getElementById('onb-skip-all').onclick = () => finishOnboarding(container);
}

function renderIncome(content, container) {
  content.innerHTML = `
    <h2 class="page-title">Qual sua renda?</h2>
    <p class="page-subtitle">1 de 6 — perfil financeiro</p>
    <form class="form-grid" id="onb-income-form">
      <div><label>Renda mensal líquida (R$)</label><input type="number" name="income" step="0.01" min="0" placeholder="Ex.: 3000"></div>
      ${stepButtons(container, {})}
    </form>
  `;
  document.getElementById('onb-skip').onclick = () => goToNextStep(container);
  document.getElementById('onb-income-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await withNextButtonLock(e.target, async () => {
      const income = new FormData(e.target).get('income');
      if (income && parseFloat(income) > 0) {
        await api('/finance/transactions', {
          method: 'POST',
          body: JSON.stringify({ description: 'Salário', amount: income, type: 'receita', dueDate: todayISO(), recurrence: 'mensal' })
        });
      }
      goToNextStep(container);
    });
  });
  wireSubmitOnNextClick();
}

function renderFixedExpenses(content, container) {
  content.innerHTML = `
    <h2 class="page-title">Despesas fixas mensais</h2>
    <p class="page-subtitle">2 de 6 — adicione as principais (aluguel, internet, assinaturas...)</p>
    <div id="onb-expenses-rows">
      ${expenseRowHtml(0)}
    </div>
    <button type="button" class="btn btn-secondary" id="onb-add-expense-row" style="margin-top:8px;">+ Adicionar outra</button>
    ${stepButtons(container, {})}
  `;
  document.getElementById('onb-skip').onclick = () => goToNextStep(container);

  let rowCount = 1;
  document.getElementById('onb-add-expense-row').onclick = () => {
    document.getElementById('onb-expenses-rows').insertAdjacentHTML('beforeend', expenseRowHtml(rowCount));
    rowCount++;
  };

  document.getElementById('onb-next').onclick = async () => {
    await withNextButtonLock(document.getElementById('onb-next'), async () => {
      const rows = document.querySelectorAll('.onb-expense-row');
      for (const row of rows) {
        const name = row.querySelector('[name="name"]').value.trim();
        const amount = row.querySelector('[name="amount"]').value;
        if (name && amount && parseFloat(amount) > 0) {
          await api('/finance/transactions', {
            method: 'POST',
            body: JSON.stringify({ description: name, amount, type: 'despesa', dueDate: todayISO(), recurrence: 'mensal' })
          });
        }
      }
      goToNextStep(container);
    });
  };
}

function expenseRowHtml(i) {
  return `
    <div class="form-row-2 onb-expense-row" style="margin-bottom:8px;">
      <input type="text" name="name" placeholder="Ex.: Aluguel" maxlength="120">
      <input type="number" name="amount" placeholder="R$" step="0.01" min="0">
    </div>`;
}

function renderDebts(content, container) {
  content.innerHTML = `
    <h2 class="page-title">Tem algum financiamento ou dívida?</h2>
    <p class="page-subtitle">3 de 6 — opcional, dá para adicionar mais depois em Financeiro → Dívidas</p>
    <form class="form-grid" id="onb-debt-form">
      <div><label>Nome</label><input type="text" name="name" maxlength="120" placeholder="Ex.: Financiamento do carro"></div>
      <div class="form-row-2">
        <div><label>Saldo devedor (R$)</label><input type="number" name="originalAmount" step="0.01" min="0"></div>
        <div><label>Parcela mensal (R$)</label><input type="number" name="installmentAmount" step="0.01" min="0"></div>
      </div>
      <div class="form-row-2">
        <div><label>Parcelas restantes</label><input type="number" name="installmentsTotal" min="1"></div>
        <div><label>Dia de vencimento</label><input type="number" name="dueDay" min="1" max="31"></div>
      </div>
      ${stepButtons(container, {})}
    </form>
  `;
  document.getElementById('onb-skip').onclick = () => goToNextStep(container);
  document.getElementById('onb-debt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await withNextButtonLock(e.target, async () => {
      const fd = new FormData(e.target);
      const name = fd.get('name')?.trim();
      if (name && fd.get('originalAmount') && fd.get('installmentAmount') && fd.get('installmentsTotal') && fd.get('dueDay')) {
        await api('/debts', {
          method: 'POST',
          body: JSON.stringify({
            name, originalAmount: fd.get('originalAmount'), installmentAmount: fd.get('installmentAmount'),
            installmentsTotal: parseInt(fd.get('installmentsTotal'), 10), startDate: todayISO(), dueDay: parseInt(fd.get('dueDay'), 10)
          })
        });
      }
      goToNextStep(container);
    });
  });
  wireSubmitOnNextClick();
}

function renderReserveAndGoals(content, container) {
  content.innerHTML = `
    <h2 class="page-title">Reserva de emergência e primeira meta</h2>
    <p class="page-subtitle">4 de 6 — opcional</p>
    <form class="form-grid" id="onb-reserve-form">
      <div><label>Meta de reserva (meses de despesas essenciais)</label><input type="number" name="emergencyFundTargetMonths" min="1" max="24" step="0.5" value="6"></div>
      <div><label>Margem de segurança mensal (R$)</label><input type="number" name="safetyMargin" step="0.01" min="0" placeholder="Ex.: 200"></div>
      <div><label>Uma meta que você já tem em mente (opcional)</label><input type="text" name="goalName" maxlength="120" placeholder="Ex.: Viagem, reserva, entrada de imóvel"></div>
      <div class="form-row-2">
        <div><label>Valor-alvo (R$)</label><input type="number" name="goalAmount" step="0.01" min="0.01"></div>
        <div><label>Prazo</label><input type="date" name="goalDeadline"></div>
      </div>
      ${stepButtons(container, {})}
    </form>
  `;
  document.getElementById('onb-skip').onclick = () => goToNextStep(container);
  document.getElementById('onb-reserve-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await withNextButtonLock(e.target, async () => {
      const fd = new FormData(e.target);
      await api('/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          emergencyFundTargetMonths: parseFloat(fd.get('emergencyFundTargetMonths')) || undefined,
          safetyMargin: fd.get('safetyMargin') || 0
        })
      });
      const goalName = fd.get('goalName')?.trim();
      if (goalName && fd.get('goalAmount')) {
        await api('/goals', {
          method: 'POST',
          body: JSON.stringify({ name: goalName, targetAmount: fd.get('goalAmount'), deadline: fd.get('goalDeadline') || undefined })
        });
      }
      goToNextStep(container);
    });
  });
  wireSubmitOnNextClick();
}

function renderRoutine(content, container) {
  content.innerHTML = `
    <h2 class="page-title">Sua rotina de hoje</h2>
    <p class="page-subtitle">5 de 6 — opcional, ajuda o Assistente a calcular seu tempo disponível</p>
    <form class="form-grid" id="onb-routine-form">
      <div><label>Compromisso fixo (ex.: trabalho)</label><input type="text" name="title" maxlength="150" placeholder="Ex.: Trabalho"></div>
      <div class="form-row-2">
        <div><label>Início</label><input type="time" name="startTime" value="09:00"></div>
        <div><label>Fim</label><input type="time" name="endTime" value="18:00"></div>
      </div>
      ${stepButtons(container, {})}
    </form>
  `;
  document.getElementById('onb-skip').onclick = () => goToNextStep(container);
  document.getElementById('onb-routine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await withNextButtonLock(e.target, async () => {
      const fd = new FormData(e.target);
      const title = fd.get('title')?.trim();
      if (title) {
        const today = todayISO();
        await api('/time/appointments', {
          method: 'POST',
          body: JSON.stringify({ title, startAt: `${today}T${fd.get('startTime')}:00Z`, endAt: `${today}T${fd.get('endTime')}:00Z` })
        });
      }
      goToNextStep(container);
    });
  });
  wireSubmitOnNextClick();
}

function renderDevelopment(content, container) {
  content.innerHTML = `
    <h2 class="page-title">Algo que você está estudando ou um hábito que quer acompanhar?</h2>
    <p class="page-subtitle">6 de 6 — opcional</p>
    <form class="form-grid" id="onb-dev-form">
      <div><label>Curso ou matéria (opcional)</label><input type="text" name="studyName" maxlength="150" placeholder="Ex.: Inglês"></div>
      <div><label>Hábito para acompanhar (opcional)</label><input type="text" name="habitName" maxlength="150" placeholder="Ex.: Ler todo dia"></div>
      ${stepButtons(container, { nextLabel: 'Concluir', showSkip: true })}
    </form>
  `;
  document.getElementById('onb-skip').onclick = () => finishOnboarding(container);
  document.getElementById('onb-dev-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await withNextButtonLock(e.target, async () => {
      const fd = new FormData(e.target);
      const studyName = fd.get('studyName')?.trim();
      const habitName = fd.get('habitName')?.trim();
      if (studyName) await api('/growth/study', { method: 'POST', body: JSON.stringify({ name: studyName }) });
      if (habitName) await api('/growth/habits', { method: 'POST', body: JSON.stringify({ name: habitName, frequency: 'diario' }) });
      await finishOnboarding(container);
    });
  });
  wireSubmitOnNextClick();
}

async function finishOnboarding(container) {
  try {
    await api('/settings', { method: 'PATCH', body: JSON.stringify({ onboardingCompleted: true }) });
  } catch { /* mesmo se falhar ao marcar, deixamos o usuário seguir para o app */ }
  currentStepIndex = STEPS.length - 1;
  renderStep(container);
}

function renderDone(content) {
  content.innerHTML = `
    <div class="card raised" style="text-align:center;">
      <h1 class="page-title">Tudo pronto</h1>
      <p class="page-subtitle">Seu app já está configurado com o que você nos contou. Você pode ajustar qualquer coisa depois em Configurações ou nas telas específicas.</p>
      <button class="btn btn-primary btn-block" id="onb-go-dashboard" style="margin-top:16px;">Ir para o Dashboard</button>
    </div>
  `;
  document.getElementById('onb-go-dashboard').onclick = () => { location.hash = 'dashboard'; };
}

// Os botões "Continuar" de cada etapa disparam o submit do form da própria
// etapa (para reaproveitar a validação nativa do HTML), exceto quando o botão
// já tem handler próprio (como no formulário de despesas, que não usa submit).
function wireSubmitOnNextClick() {
  const nextBtn = document.getElementById('onb-next');
  if (!nextBtn || nextBtn.onclick) return; // já tem handler custom
  const form = nextBtn.closest('form');
  if (form) nextBtn.onclick = () => form.requestSubmit();
}

async function withNextButtonLock(triggerEl, fn) {
  const nextBtn = document.getElementById('onb-next');
  const skipBtn = document.getElementById('onb-skip');
  const msg = document.getElementById('onb-msg');
  if (nextBtn.disabled) return;
  nextBtn.disabled = true;
  if (skipBtn) skipBtn.disabled = true;
  if (msg) { msg.textContent = ''; msg.classList.remove('error'); }
  try {
    await fn();
  } catch (err) {
    if (msg) { msg.textContent = err.message; msg.classList.add('error'); }
    nextBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;
  }
}
