const routes = new Map(); // hash -> { label, icon, render(container) }
let currentCleanup = null;

export function registerRoute(hash, config) {
  routes.set(hash, config);
}

function navItemHtml(hash, cfg, activeHash) {
  return `
    <div class="nav-item ${hash === activeHash ? 'active' : ''}" data-hash="${hash}">
      <i class="ti ti-${cfg.icon}" aria-hidden="true"></i>
      <span>${cfg.label}</span>
      <span class="dot"></span>
    </div>
  `;
}

export function navItemsHtml(activeHash) {
  return [...routes.entries()]
    .filter(([, cfg]) => !cfg.hidden)
    .map(([hash, cfg]) => navItemHtml(hash, cfg, activeHash))
    .join('');
}

// A barra inferior do celular não cabe todos os itens do menu (9 no total) —
// mostra só os "primary" e agrupa o resto atrás do botão "Mais".
export function bottomNavHtml(activeHash) {
  const entries = [...routes.entries()].filter(([, cfg]) => !cfg.hidden);
  const primary = entries.filter(([, cfg]) => cfg.primary);
  const secondary = entries.filter(([, cfg]) => !cfg.primary);
  const moreActive = secondary.some(([hash]) => hash === activeHash);
  const moreHtml = `
    <div class="nav-item ${moreActive ? 'active' : ''}" data-more="1">
      <i class="ti ti-dots" aria-hidden="true"></i>
      <span>Mais</span>
      <span class="dot"></span>
    </div>
  `;
  const primaryHtml = primary.map(([hash, cfg]) => navItemHtml(hash, cfg, activeHash)).join('') + moreHtml;
  const secondaryHtml = secondary.map(([hash, cfg]) => navItemHtml(hash, cfg, activeHash)).join('');
  return { primaryHtml, secondaryHtml };
}

async function renderCurrentRoute() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const config = routes.get(hash) || routes.get('dashboard');
  const resolvedHash = routes.has(hash) ? hash : 'dashboard';

  const isFullScreen = !!config.fullScreen;
  document.getElementById('sidebar').style.display = isFullScreen ? 'none' : '';
  document.getElementById('bottom-nav').style.display = isFullScreen ? 'none' : '';

  document.getElementById('sidebar-nav').innerHTML = navItemsHtml(resolvedHash);
  const { primaryHtml, secondaryHtml } = bottomNavHtml(resolvedHash);
  document.getElementById('bottom-nav-row').innerHTML = primaryHtml;
  document.getElementById('more-menu-list').innerHTML = secondaryHtml;
  attachNavHandlers();

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch { /* view não tinha cleanup */ }
  }

  const container = document.getElementById('view-container');
  container.innerHTML = '<div class="empty-state">Carregando...</div>';
  currentCleanup = await config.render(container);
}

function attachNavHandlers() {
  document.querySelectorAll('.nav-item[data-hash]').forEach(item => {
    item.onclick = () => {
      location.hash = item.dataset.hash;
      document.getElementById('more-menu').close();
    };
  });
  const moreBtn = document.querySelector('#bottom-nav-row [data-more]');
  if (moreBtn) {
    moreBtn.onclick = () => document.getElementById('more-menu').showModal();
  }
}

export function startRouter() {
  window.addEventListener('hashchange', renderCurrentRoute);
  renderCurrentRoute();
}
