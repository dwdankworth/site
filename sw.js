/* Service worker — offline cache for danksite.
 * Strategy:
 *   - cache-first for static assets (HTML, CSS, JS, font CSS)
 *   - stale-while-revalidate for data/content.json
 */
const VERSION = 'danksite-v1';
const STATIC_ASSETS = [
  './',
  'index.html',
  'css/terminal.css',
  'js/streaming.js',
  'js/commands.js',
  'js/easter-eggs.js',
  'js/terminal.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Stale-while-revalidate for content.json
  if (url.pathname.endsWith('/data/content.json')) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((resp) => {
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Cache-first for same-origin static assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((resp) => {
          if (resp && resp.ok && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
          }
          return resp;
        }).catch(() => cached);
      })
    );
  }
});
