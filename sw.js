importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js");

if (self.workbox) {
  const { precaching, routing, strategies, expiration, cacheableResponse } = self.workbox;

  // Precache core files
  precaching.precacheAndRoute([
    { url: 'index.html', revision: '0ffc642bac0e9aeff9f6feeb6e32a1e9' },
    { url: 'registerSW.js', revision: '402b66900e731ca748771b6fc5e7a068' },
    { url: 'manifest.webmanifest', revision: '4831ad2c45f2e547b896b0b60e02b74c' },
    { url: 'style.css', revision: 'pwa-style-v1' },
    { url: 'app.js', revision: 'pwa-app-v1' }
  ]);

  // Cache images (WebP) with CacheFirst strategy
  routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new strategies.CacheFirst({
      cacheName: 'images-cache',
      plugins: [
        new expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Cache static assets (JS, CSS, Fonts) with NetworkFirst to ensure updates
  routing.registerRoute(
    ({ request }) => 
      request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'font' ||
      request.url.includes('/assets/'),
    new strategies.NetworkFirst({
      cacheName: 'static-resources',
      networkTimeoutSeconds: 5,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // Navigation route: NetworkFirst with fallback to index.html
  routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new strategies.NetworkFirst({
      cacheName: 'navigation',
      networkTimeoutSeconds: 3,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });
}
