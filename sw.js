/* ==========================================================================
   GUARDEI — SERVICE WORKER (sw.js)
   Suporta instalação PWA e intercepta compartilhamentos via POST (Share Target).
   ========================================================================== */

const CACHE_NAME = 'guardei-mvp-v1';
const ARQUIVOS_ESTATICOS = [
  './',
  './index.html',
  './manifest.json',
  './css/theme.css',
  './css/style.css',
  './js/config.js',
  './js/utils.js',
  './js/auth.js',
  './js/storage.js',
  './js/database.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_ESTATICOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Trata o compartilhamento externo configurado no manifest.json (POST em ./index.html)
  if (request.method === 'POST' && url.pathname.endsWith('/index.html')) {
    event.respondWith(tratarShareTarget(request));
    return;
  }

  // Para requisições GET estáticas do próprio domínio, tenta rede e cai no cache se necessário
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

async function tratarShareTarget(request) {
  try {
    const formData = await request.formData();
    const titulo = formData.get('shared_title') || '';
    const texto = formData.get('shared_text') || '';
    const link = formData.get('shared_url') || '';

    const params = new URLSearchParams();
    if (titulo) params.set('shared_title', titulo);
    if (texto) params.set('shared_text', texto);
    if (link) params.set('shared_url', link);

    const destino = `./index.html${params.toString() ? `?${params.toString()}` : ''}`;
    return Response.redirect(destino, 303);
  } catch {
    return Response.redirect('./index.html', 303);
  }
}
