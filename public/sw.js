// MetsXMFanZone legacy service worker cleanup.
// Page requests intentionally bypass this worker. Push is handled by
// /service-worker.js so Android in-app browsers cannot lose a navigation to a
// rejected service-worker fetch.

// Install - immediately take over
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate - destroy ALL caches immediately and notify clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((name) => caches.delete(name)));
      await self.clients.claim();

      // Tell every open client that a new version is active so it can prompt for refresh
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        try {
          client.postMessage({ type: 'SW_UPDATED', version: 'v4' });
        } catch (e) {
          // Ignore clients that can't receive messages
        }
      });
    })()
  );
});


// Push notification event
self.addEventListener('push', (event) => {
  let data = {
    title: 'MetsXM FanZone',
    body: 'You have a new notification!',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const isLiveGame = data.tag === 'live-game' || data.tag === 'game-alert' || (data.title && data.title.toLowerCase().includes('live'));

  const options = {
    body: data.body,
    icon: data.icon || '/logo-192.png',
    badge: data.badge || '/logo-192.png',
    vibrate: isLiveGame ? [300, 100, 300, 100, 300] : [200, 100, 200],
    tag: data.tag || 'metsxm-notification',
    renotify: true,
    requireInteraction: isLiveGame,
    silent: false,
    data: { url: data.url || '/', dateOfArrival: Date.now() },
    actions: [
      { action: 'open', title: isLiveGame ? '🏟️ Watch Now' : 'View Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('notificationclose', () => {});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(Promise.resolve());
  }
});
