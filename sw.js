const CACHE_NAME = 'trail-event-planner-v104';
const APP_SHELL = ['./', './index.html', './design-system.css', './race-tools.js', './season-tools.js', './alpine-performance.js', './event-dates.json', './manifest.webmanifest', './trail-icon.svg'];

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

// Handles server-sent Web Push messages once a VAPID sender and subscriptions are configured.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body: event.data ? event.data.text() : '' }; }
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Trail Event Planner';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Es gibt einen neuen Änderungsvorschlag zur Prüfung.',
    icon: './trail-icon.svg',
    badge: './trail-icon.svg',
    tag: typeof payload.tag === 'string' ? payload.tag : 'trail-event-review',
    data: { url: typeof payload.url === 'string' ? payload.url : './' },
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        return client.navigate(target).then(() => client.focus());
      }
    }
    return self.clients.openWindow(target);
  }));
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

  const isAppCode = /\.(?:js|mjs|css|html|webmanifest)$/.test(url.pathname) || request.mode === 'navigate';
  if (isAppCode) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const key = request.mode === 'navigate' ? './index.html' : request;
            const copy = response.clone();
            return caches.open(CACHE_NAME).then(cache => cache.put(key, copy)).then(() => response);
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
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
