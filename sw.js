/* global importScripts, self */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (self.workbox) {
  self.workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
}

const CACHE_NAMES = {
  STATIC: 'static-v2',
  API: 'api-v2',
  NAV: 'nav-v2',
  IMAGES: 'images-v2',
};

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'DFWA', body: 'New notification' };
  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: self.registration.scope,
    },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!Object.values(CACHE_NAMES).includes(key)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API-Anfragen: Stale-While-Revalidate für Leaderboard & Analytics
  if (url.pathname.startsWith('/api/')) {
    // Nur GET-Requests cachen
    if (event.request.method !== 'GET') return;

    event.respondWith(
      self.caches.open(CACHE_NAMES.API).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Bilder: Cache-First mit Fallback (für Low-End-Geräte optimiert)
  if (/\.(png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const cacheClone = networkResponse.clone();
              caches.open(CACHE_NAMES.IMAGES).then((cache) => cache.put(event.request, cacheClone));
            }
            return networkResponse;
          })
        );
      })
    );
    return;
  }

  // JS/CSS/Fonts: Stale-While-Revalidate für schnelle Updates
  if (/\.(js|css|woff2?|ttf|eot)$/i.test(url.pathname) || url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAMES.STATIC).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Navigation: Network-First mit Cache Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const cacheClone = response.clone();
            caches.open(CACHE_NAMES.NAV).then((cache) => cache.put(event.request, cacheClone));
            return response;
          }
          return caches.match('./index.html');
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(event.request);
        })
    );
  }
});
