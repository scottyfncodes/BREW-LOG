// BREW LOG service worker: offline app shell.
// HTML is network-first (so updates arrive), hashed assets are cache-first.
const CACHE = 'brew-log-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/favicon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(SHELL);
      // Also precache the hashed JS/CSS the current index.html points at.
      try {
        const html = await (await fetch('./index.html', { cache: 'no-store' })).text();
        const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
        await c.addAll(assets);
      } catch {
        /* offline during install: runtime caching will fill in */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/icons/'))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
