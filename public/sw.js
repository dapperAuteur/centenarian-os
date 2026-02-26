// File: public/sw.js
// Service Worker — stale-while-revalidate for API, cache-first for pages, offline fallback

const CACHE_VERSION = 'centos-v4';
const STATIC_URLS = [
  '/',
  '/offline.html',
  '/dashboard/planner',
  '/dashboard/fuel',
  '/dashboard/fuel/meals',
  '/dashboard/engine',
  '/dashboard/analytics',
  '/dashboard/metrics',
  '/dashboard/weekly-review',
  '/dashboard/correlations',
  '/dashboard/fuel/recipe-ideas',
  '/dashboard/finance',
  '/dashboard/finance/transactions',
  '/dashboard/travel',
  '/dashboard/travel/trips',
  '/dashboard/workouts',
];

// Install: pre-cache static pages
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_URLS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API routes: stale-while-revalidate
  // Return cached response immediately if available, update cache in background
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // Network failed — cached version is all we have
            return cached || new Response('{"error":"Offline"}', {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          });

        // Return cache immediately if available, otherwise wait for network
        return cached || networkFetch;
      })
    );
    return;
  }

  // Pages & assets: cache-first with network fallback + offline.html safety net
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Navigation request with no cache — show offline page
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('', { status: 503 });
        });
    })
  );
});
