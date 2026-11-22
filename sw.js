// LifeTag service worker: network-first for the shell so updates land fast,
// cache only as an offline fallback (lesson learned from LearnMate).
const CACHE = 'resq-v6';
const SHELL = ['./', './index.html', './css/fonts.css', './css/styles.css', './js/qrcode.js', './js/firebase-config.js', './js/store.js', './js/i18n.js', './js/app.js', './manifest.webmanifest', './fonts/BricolageGrotesque-800-latin.woff2', './fonts/SourceSans3-400-latin.woff2', './fonts/SourceSans3-600-latin.woff2', './fonts/SourceSans3-700-latin.woff2', './audio/guide-ur.mp3', './audio/guide-en.mp3'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
