const CACHE_NAME = 'thepool-pwa-v313';
const OFFLINE_URL = '/offline.html';
const CORE = [
  OFFLINE_URL,
  '/manifest.webmanifest?v=310',
  '/assets/icons/icon-192.png?v=310',
  '/assets/icons/icon-512.png?v=310',
  '/assets/icons/apple-touch-icon.png?v=310'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('thepool-pwa-') || key.startsWith('bbl-pwa-')) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache or replay live API data. NHL scoring, Redis state and Pick'em must always come from the network.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static files are network-first. Cache only as an offline fallback after a successful live response.
  if (url.pathname.startsWith('/assets/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
  }
});
