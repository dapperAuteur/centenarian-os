// File: public/sw.js
// Service Worker for offline caching

const CACHE_NAME = 'centos-v1';
const urlsToCache = [
  '/',
  '/planner',
  '/fuel',
  '/engine',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});