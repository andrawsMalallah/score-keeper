const CACHE_NAME = 'score-keeper-v1';

// All assets needed to run the app offline
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // External CDN asset cached on first load
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

// ── Install: pre-cache all local assets ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cache local assets (must succeed)
      await cache.addAll([
        './',
        './index.html',
        './manifest.json',
        './icons/icon-192.png',
        './icons/icon-512.png',
      ]);
      // Cache CDN asset separately (best-effort — don't block install if offline)
      try {
        await cache.add('https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js');
      } catch (_) {
        console.warn('SW: Could not pre-cache CDN asset (offline at install time)');
      }
    })
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ── Fetch: cache-first strategy ──────────────────────────────────────────────
// 1. Return cached version if available
// 2. Otherwise fetch from network and cache the response
// 3. If network fails too, return a fallback
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network
      return fetch(event.request)
        .then(response => {
          // Don't cache bad responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          // Cache a clone (response can only be consumed once)
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          return response;
        })
        .catch(() => {
          // Network failed — if it's a navigation, serve the app shell
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
