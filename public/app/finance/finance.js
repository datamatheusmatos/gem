import { renderAccounts } from './accounts.js';
import { renderCards } from './cards.js';
import { renderTransactions } from './transactions.js';
import { renderBudgets } from './budgets.js';
import { renderDebts } from './debts.js';
import { renderInvestments } from './investments.js';
import { renderSimulator } from './simulator.js';

const TABS = [
  { key: 'contas', label: 'Contas', render: renderAccounts },
  { key: 'cartoes', label: 'Cartões', render: renderCards },
  { key: 'transacoes', label: 'Transações', render: renderTransactions },
  { key: 'orcamento', label: 'Orçamento', render: renderBudgets },
  { key: 'dividas', label: 'Dívidas', render: renderDebts },
  { key: 'investimentos', label: 'Investimentos', render: renderInvestments },
  { key: 'simulador', label: 'Simulador', render: renderSimulator }
];

let activeTab = TABS[0].key;

export async function renderFinance(container) {
  container.innerHTML = `
    <h1 class="page-title">Financeiro</h1>
    <div class="tabs" id="finance-tabs">
      ${TABS.map(t => `<button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>
    <div id="finance-tab-content"></div>
  `;

  document.querySelectorAll('#finance-tabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('#finance-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
      renderActiveTab();
    };
  });

  await renderActiveTab();
}

async function renderActiveTab() {
  const tab = TABS.find(t => t.key === activeTab);
  const content = document.getElementById('finance-tab-content');
  content.innerHTML = '<div class="empty-state">Carregando...</div>';
  await tab.render(content);
}
