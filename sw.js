const CACHE_NAME = 'dfwa-v' + new Date().getTime();
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './questions_i18n.json',
  './ack_comments.json',
  './assets/fonts/inter-900.woff2',
  './assets/images/ack_core_clean.png',
  './assets/images/ack_core_closed_clean.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first for critical assets to ensure latest version
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clonedResponse = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clonedResponse);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
