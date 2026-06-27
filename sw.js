/* QA:
Build site and open in browser.
Register SW and open DevTools > Application > Cache Storage.
Deploy changed ASSETS (e.g., change style.css).
Deploy new sw.js and reload page.
Verify only 'dfwa-cache-v1' exists and assets updated.
If verification fails, abort and report cache names.
*/
const CACHE_NAME = 'dfwa-cache-v1';
const ASSETS = [
'./',
'./index.html',
'./app.js',
'./style.css',
'./manifest.json',
'./questions_i18n.json',
'./ack_comments.json',
'./assets/fonts/inter-900.woff2',
'./assets/images/ack_core_clean.png',
'./assets/images/ack_core_closed_clean.png',
'./assets/icons/icon-192.png',
'./assets/icons/icon-512.png',
'./assets/icons/icon-192-maskable.png',
'./assets/icons/icon-512-maskable.png'
];
self.addEventListener('install', event => {
self.skipWaiting();
event.waitUntil(
caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
);
});
self.addEventListener('activate', event => {
event.waitUntil(
caches.keys().then(keys =>
Promise.all(keys.map(key => {
if (key !== CACHE_NAME) return caches.delete(key);
return Promise.resolve();
}))
).then(() => self.clients.claim())
);
});
self.addEventListener('fetch', event => {
event.respondWith(
caches.match(event.request).then(cachedResponse => {
if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(response => {
if (!response || response.status !== 200 || response.type !== 'basic') return response;
const responseClone = response.clone();
caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
return response;
}).catch(() => {
if (event.request.mode === 'navigate') return caches.match('./index.html');
return caches.match(event.request);
});
})
);
});
