// ============================================================
// FASO DIGIT TRADE - SERVICE WORKER
// Permet l'installation de l'application (PWA) et met en
// cache les fichiers statiques pour un chargement plus rapide.
// ============================================================

const CACHE_NAME = 'faso-digit-trade-v5';

const STATIC_ASSETS = [
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];


self.addEventListener('install', (event) => {

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );

  self.skipWaiting();
});


self.addEventListener('activate', (event) => {

  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
  );

  self.clients.claim();
});


// Stratégie : réseau d'abord, cache en secours (utile hors-ligne).
// Les appels vers Supabase (API) ne sont jamais mis en cache.

self.addEventListener('fetch', (event) => {

  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') {
    return;
  }

  if (url.origin.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {

        const clone = response.clone();

        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone))
          .catch(() => {});

        return response;
      })
      .catch(() =>
        caches.match(event.request)
      )
  );
});


// ============================================================
// NOTIFICATIONS PUSH (nouvelles commandes / inscriptions - admin)
// ============================================================

self.addEventListener('push', (event) => {

  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      title: 'FASO DIGIT TRADE',
      body: event.data ? event.data.text() : ''
    };
  }

  const title =
    payload.title || 'FASO DIGIT TRADE';

  const options = {
    body: payload.body || '',
    icon: './icons/icon-notif-192.png',
    badge: './icons/badge-96.png',
    data: payload.url || './admin.html'
  };

  event.waitUntil(
    (async () => {

      await self.registration.showNotification(title, options);

      if (
        'setAppBadge' in self.registration &&
        typeof payload.badgeCount === 'number'
      ) {

        try {
          await self.registration.setAppBadge(payload.badgeCount);
        } catch (e) {}

      }

    })()
  );

});


self.addEventListener('notificationclick', (event) => {

  event.notification.close();

  const targetUrl = event.notification.data || './admin.html';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {

        for (const client of clientList) {
          if (client.url.includes('admin.html') && 'focus' in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }

      })
  );

});
