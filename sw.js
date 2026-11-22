/* Service Worker：把应用外壳缓存到本地，新版本自动接管 */
const VERSION = '1.0.11';
const CACHE = 'watchnext-' + VERSION;
const ASSETS = [
  './', './index.html', './css/app.css', './css/mobile.css',
  './js/data-1.js', './js/data-2.js', './js/data-3.js', './js/data.js', './js/people-map.js',
  './js/store.js', './js/engine.js', './js/tmdb.js',
  './js/app.js', './js/views.js', './js/detail.js', './js/events.js', './js/v108.js','./js/library-link.js','./js/v110.js','./js/v111.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   /* TMDB 接口与海报走网络，不缓存 */

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return r;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
