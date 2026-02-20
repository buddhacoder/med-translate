// MedTranslate Service Worker — network-first for API, cache-first for static
const CACHE_NAME = 'medtranslate-v7';
const STATIC_ASSETS = [
  '/', '/index.html', '/styles/app.css', '/js/app.js',
  '/manifest.json', '/icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Network-first for API calls
  if (e.request.url.includes('/api/') || e.request.url.includes('wss://')) return;

  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return resp;
      }))
      .catch(() => caches.match('/index.html'))
  );
});
