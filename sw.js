const SW_VERSION = 'v1.1.0';
const CACHE_NAME = `dfwa-cache-${SW_VERSION}`;

// Statische Assets ohne Hash-Dateinamen (Vite-Build-kompatibel)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './questions_i18n.json',
  './ack_comments.json',
  './assets/fonts/inter-900.woff2',
  './assets/images/ack_core_clean.webp',
  './assets/images/ack_core_closed_clean.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('dfwa-cache-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => {
        self.clients.claim();
        // Informiere alle Clients über das erfolgreiche Update
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION })
          );
        });
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API-Anfragen nicht cachen
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return caches.match(event.request);
        });
    })
  );
});
