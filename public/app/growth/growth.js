import { renderStudy } from './study.js';
import { renderProjects } from './projects.js';
import { renderHabits } from './habits.js';
import { renderRoutines } from './routines.js';

const TABS = [
  { key: 'estudos', label: 'Estudos', render: renderStudy },
  { key: 'projetos', label: 'Projetos', render: renderProjects },
  { key: 'habitos', label: 'Hábitos', render: renderHabits },
  { key: 'rotinas', label: 'Rotinas', render: renderRoutines }
];

let activeTab = TABS[0].key;

export async function renderGrowth(container) {
  container.innerHTML = `
    <h1 class="page-title">Estudos e desenvolvimento</h1>
    <div class="tabs" id="growth-tabs">
      ${TABS.map(t => `<button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>
    <div id="growth-tab-content"></div>
  `;

  document.querySelectorAll('#growth-tabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('#growth-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
      renderActiveTab();
    };
  });

  await renderActiveTab();
}

async function renderActiveTab() {
  const tab = TABS.find(t => t.key === activeTab);
  const content = document.getElementById('growth-tab-content');
  content.innerHTML = '<div class="empty-state">Carregando...</div>';
  await tab.render(content);
}
