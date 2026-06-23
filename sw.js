const CACHE_NAME = 'dfwa-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './questions_i18n.json'
];

// Install Event - Cache all assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.log('Cache addAll error:', err);
        // Continue even if some assets fail
        return Promise.all(
          ASSETS.map(asset => cache.add(asset).catch(() => null))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Fetch Event - Cache First, Fall back to Network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      
      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response && response.status === 200 && response.type !== 'error') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Return cached version if network fails
        return caches.match(event.request);
      });
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});
