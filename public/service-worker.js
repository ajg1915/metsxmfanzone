// MetsXMFanZone service worker v5: push notifications only. It does NOT cache pages
// or assets, so a deploy can never leave an installed copy pointing at missing files.
importScripts("https://js.pusher.com/beams/service-worker.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});
