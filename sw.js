const CACHE_NAME = 'app-shell-v1'; // subir este número a cada release relevante
const SHELL_FILES = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // nunca cachear chamadas de API/dados financeiros
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((r) => { const clone = r.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, clone)); return r; })
      .catch(() => caches.match(event.request).then(c => c || caches.match('/index.html')))
  );
});
