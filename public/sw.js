const CACHE_NAME = 'orby-cache-v2';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { request } = event;

  const cacheResponse = (response) => {
    if (!response || response.status !== 200 || response.type !== 'basic') {
      return response;
    }
    const responseToCache = response.clone();
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(request, responseToCache).catch(() => {});
    });
    return response;
  };

  // Page navigations go network-first so a new deploy is visible immediately;
  // the cache is only a fallback for offline use.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(cacheResponse)
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then(cacheResponse).catch(() => cachedResponse);
    }),
  );
});
