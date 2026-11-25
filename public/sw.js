// Bump this version when releasing a changed application shell.
const CACHE = 'tt-static-20261124-pwa-v2';
// Exact allowlist: no order token, API response, recipient image or proof is cached.
const STATIC = ['/index.html','/app.js','/draft-store.js','/style.css','/pwa.js','/pwa.css',
  '/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png',
  '/icons/icon-maskable-512.png','/icons/apple-touch-icon.png','/fonts/NotoSansMalayalam.ttf'];
const SHELL_ROUTES = ['/', '/index.html', '/o', '/staff'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC.map(url => new Request(url,{cache:'reload',credentials:'omit'})))));
  // An updated worker waits for a deliberate user update. IndexedDB is untouched.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('tt-static-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || url.pathname==='/api' || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate' && SHELL_ROUTES.includes(url.pathname)) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cached = await (await caches.open(CACHE)).match('/index.html');
      return cached || new Response('Reconnect to open your order. Your phone drafts have not been deleted.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }));
  } else if (STATIC.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
