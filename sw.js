// Service worker: precache the whole app (shell + data + every flag) so it works
// fully offline once loaded. Bump CACHE whenever you redeploy changed assets.
const CACHE = 'flags-capitals-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('./precache-manifest.json', { cache: 'no-cache' });
      const urls = await res.json();
      await cache.addAll(urls);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    (async () => {
      // Cache-first: everything we need was precached, so this is instant + offline.
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(req);
      } catch {
        // Offline and uncached: fall back to the app shell for navigations.
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
