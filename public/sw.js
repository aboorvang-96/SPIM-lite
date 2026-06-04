// CACHE_NAME must be changed on every deployment that changes app code so
// that iOS Safari re-installs the service worker (Safari only updates the SW
// when the file bytes change; bumping this string achieves that).
const CACHE_NAME = 'spim-lite-v2';

// Only truly static, immutable assets go here.
// '/' (index.html) is intentionally excluded: pre-caching it would let iOS
// serve a stale build if the network fetch later fails.  The app needs network
// for Railway API data anyway, so graceful offline is not a goal.
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.png',        // was '/assets/icon.png' (404) — correct path after PWA icon fix
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle GET requests.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cross-origin requests (Railway API at spim-suite-production.up.railway.app)
  // are never intercepted by the service worker — the browser enforces this
  // automatically.  The pathname guard below is kept as an explicit safety net
  // for any same-origin /api/ proxy routes that may be added in future.
  if (url.pathname.startsWith('/api/')) return;

  // Network-first for everything else.  On success, cache static assets so
  // icons/fonts survive a brief offline period.  On failure fall back to
  // cache — the app will at least render, even if API data is stale.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (url.pathname.startsWith('/assets/') ||
            url.pathname === '/icon.png' ||
            url.pathname === '/favicon.png' ||
            url.pathname === '/manifest.json') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
