/* NAAS service worker — offline support per URS UR-28, AC-05.
   Strategy:
     - static shell (HTML, CSS, JS, icons): cache-first
     - /api/*: network-first with cache fallback
*/
const VERSION = 'naas-v0.1.0';
const STATIC_CACHE = `naas-static-${VERSION}`;
const RUNTIME_CACHE = `naas-runtime-${VERSION}`;
const OFFLINE_URLS = ['/', '/login.html', '/register.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(OFFLINE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static shell: cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => caches.match('/')),
    ),
  );
});
