importScripts('./version.js');

const PREFIX = 'bukvoid-';
const CACHE = `${PREFIX}${self.APP_VERSION}-${self.APP_BUILD}`;
const ASSETS = [
  './',
  './index.html',
  './version.js',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/blocks.js',
  './js/layouts.js',
  './js/typing.js',
  './js/quiz.js',
  './js/course.js',
  './js/srs.js',
  './js/sync.js',
  './js/config.js',
  './js/google-token.js',
  './js/drive-files.js',
  './js/bot.js',
  './js/bot-key.js',
  './js/cloud.js',
  './js/data/words.js',
  './js/courses.js',
  './courses/index.json',
  './courses/uk-pravopys.json',
  './js/data/en-a2.js',
  './js/data/en-b1.js',
  './fonts/unbounded-cyr.woff2',
  './fonts/unbounded-lat.woff2',
  './fonts/jbmono-cyr.woff2',
  './fonts/jbmono-lat.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/author.jpg',
];

// Файли — повз HTTP-кеш браузера: GitHub Pages віддає max-age=600.
const precache = () => caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))));

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

/** Сусідній застосунок на цьому ж домені (shooting-log) під час оновлення видаляє чужі кеші — докладаємо, чого бракує. */
async function repairCache() {
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const missing = ASSETS.map((url) => new URL(url, self.registration.scope).href).filter((url) => !have.has(url));
  if (missing.length) await cache.addAll(missing.map((url) => new Request(url, { cache: 'reload' })));
}

// Кеші інших застосунків на vitaliylobko.github.io не чіпаємо — лише свої старі версії.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.waitUntil(repairCache().catch(() => {}));
  // Каталог і курси — спершу мережа: новий курс у репо видно без нової версії застосунку
  if (new URL(request.url).pathname.includes('/courses/')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(request, { cache: 'no-cache' });
        if (res.ok) (await caches.open(CACHE)).put(request, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const cached = await caches.match(request, { ignoreSearch: true, cacheName: CACHE });
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true, cacheName: CACHE });
    if (cached) return cached;
    try {
      return await fetch(request);
    } catch (err) {
      if (request.mode === 'navigate') return caches.match('./index.html', { cacheName: CACHE });
      throw err;
    }
  })());
});
