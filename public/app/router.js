const routes = new Map(); // hash -> { label, icon, render(container) }
let currentCleanup = null;

export function registerRoute(hash, config) {
  routes.set(hash, config);
}

export function navItemsHtml(activeHash) {
  return [...routes.entries()]
    .filter(([, cfg]) => !cfg.hidden)
    .map(([hash, cfg]) => `
    <div class="nav-item ${hash === activeHash ? 'active' : ''}" data-hash="${hash}">
      <i class="ti ti-${cfg.icon}" aria-hidden="true"></i>
      <span>${cfg.label}</span>
      <span class="dot"></span>
    </div>
  `).join('');
}

async function renderCurrentRoute() {
  const hash = location.hash.replace('#', '') || 'dashboard';
  const config = routes.get(hash) || routes.get('dashboard');
  const resolvedHash = routes.has(hash) ? hash : 'dashboard';

  const isFullScreen = !!config.fullScreen;
  document.getElementById('sidebar').style.display = isFullScreen ? 'none' : '';
  document.getElementById('bottom-nav').style.display = isFullScreen ? 'none' : '';

  document.getElementById('sidebar-nav').innerHTML = navItemsHtml(resolvedHash);
  document.getElementById('bottom-nav-row').innerHTML = navItemsHtml(resolvedHash);
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
    item.onclick = () => { location.hash = item.dataset.hash; };
  });
}

export function startRouter() {
  window.addEventListener('hashchange', renderCurrentRoute);
  renderCurrentRoute();
}
