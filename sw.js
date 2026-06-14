// ============================================================
// ULTRAS LUTETIA — Service Worker v1
// ============================================================

const CACHE_NAME = 'ul-v1';
const ASSETS = [
  '/ultras-lutetia/',
  '/ultras-lutetia/index.html',
  '/ultras-lutetia/admin.html',
  '/ultras-lutetia/manifest.webmanifest',
  '/ultras-lutetia/src/config.js',
  '/ultras-lutetia/src/supabase-client.js',
  '/ultras-lutetia/src/styles.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Ne pas intercepter les requêtes Supabase
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/ultras-lutetia/index.html'));
    })
  );
});
