const SW_VERSION = 'v1.0.3'; // Version erhöht, um Cache-Update zu erzwingen
const CACHE_NAME = `dfwa-cache-${SW_VERSION}`;

const ASSETS = [
    './',
    './index.html',
    './app.js',
    './scripts/storage.js',
    './scripts/game-logic.js',
    './scripts/ui-manager.js',
    './scripts/api-client.js',
    './style.css',
    './manifest.json',
    './questions_i18n.json',
    './ack_comments.json',
    './assets/fonts/inter-900.woff2',
    './assets/images/ack_core_clean.png',
    './assets/images/ack_core_closed_clean.png',
    './assets/images/ack_eye_skeptical.png',
    './assets/images/ack_brow_only.png',
    './assets/images/ack_eye_wink.png',
    './assets/images/ack_eye_base_only.png',
    './assets/images/acker_core.png',
    './assets/images/dystopian_monitor.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/icon-192-maskable.png',
    './assets/icons/icon-512-maskable.png',
    './download.html'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key.startsWith('dfwa-cache-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => {
            self.clients.claim();
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION }));
            });
        })
    );
});

self.addEventListener('fetch', event => {
    // Network-first Strategie für JSON-Daten, damit diese nicht im alten Cache stecken bleiben
    if (event.request.url.endsWith('.json')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') return response;
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                return response;
            });
        })
    );
});
