const SW_VERSION = 'v1.0.4'; 
const CACHE_NAME = `dfwa-cache-${SW_VERSION}`;

const ASSETS = [
    './', './index.html', './app.js', './scripts/storage.js',
    './scripts/game-logic.js', './scripts/ui-manager.js', './scripts/api-client.js',
    './style.css', './manifest.json', './questions_i18n.json', './ack_comments.json'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => key.startsWith('dfwa-cache-') && key !== CACHE_NAME).map(key => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Network-First für Daten, um veraltete Fragen zu vermeiden
    if (event.request.url.includes('.json')) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
