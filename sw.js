// Asy & Wąsy — service worker: dzięki niemu aplikacja instaluje się i działa bez internetu.
// Po każdej zmianie plików gry podbij numer wersji, żeby telefony pobrały nową wersję.
const VERSION = 'paw-deck-v5.10.0';
const SHELL_CACHE = `${VERSION}-shell`;
const CDN_CACHE = `${VERSION}-cdn`;

// Pliki samej gry.
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

// Biblioteki z CDN, których gra potrzebuje do startu.
const CDN = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@8.1.2/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700;800&display=swap'
];

// Hosty, z których wolno zapisywać odpowiedzi w pamięci podręcznej (statyczne zasoby, nie dane gry).
const CACHEABLE_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL);
    const cdn = await caches.open(CDN_CACHE);
    // Każdą bibliotekę pobieramy osobno — brak jednej nie blokuje instalacji.
    await Promise.all(CDN.map(async (url) => {
      try {
        const res = await fetch(url, { mode: url.includes('tailwindcss') || url.includes('cdnjs') ? 'no-cors' : 'cors' });
        if (res.ok || res.type === 'opaque') await cdn.put(url, res);
      } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('paw-deck-') && !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pliki gry: najpierw sieć (zawsze świeża wersja), bez sieci — kopia z pamięci.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await cache.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const index = await cache.match('index.html');
          if (index) return index;
        }
        throw e;
      }
    })());
    return;
  }

  // Biblioteki i czcionki: najpierw pamięć (szybki start, działa offline), w tle odświeżenie.
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(req);
      const refresh = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      const res = await refresh;
      if (res) return res;
      return Response.error();
    })());
  }
  // Wszystko inne (np. Firestore — dane gry online) idzie prosto do sieci.
});
