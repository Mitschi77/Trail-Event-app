const CACHE_NAME = 'trail-event-planner-v43';
const APP_SHELL = ['./', './index.html', './race-tools.js', './season-tools.js', './event-dates.json', './manifest.webmanifest', './trail-icon.svg', './trail-apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('trail-event-planner-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/event-dates.json')) {
    const cacheKey = new URL(url.pathname, self.location.origin).href;
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            return caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, copy)).then(() => response);
          }
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            return caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)).then(() => response);
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          return caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).then(() => response);
        }
        return response;
      });
    })
  );
});
