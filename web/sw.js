/* Service worker: offline cache + notification display */
const CACHE = 'asma-v33';
const ASSETS = [
  'app.html', 'style.css', 'app.js', 'dial.js', 'core.js', 'content.js', 'learn-salah.js', 'names.js',
  'content/dict.json', 'content/roots.json',
  'manifest.webmanifest', 'fonts/amiri-arabic-400-normal.woff2', 'fonts/amiri-arabic-700-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'index.html', 'land.css', 'land.js', 'boot.js', 'island-themes.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(u => c.add(u).catch(() => undefined)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  const isApp = /app\.html$/.test(path);
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(r => {
        if (r && r.ok) {
          const copy = r.clone();
          const key = isApp ? 'app.html' : (path === '/' || /index\.html$/.test(path) ? 'index.html' : req);
          caches.open(CACHE).then(c => c.put(key, copy));
          return r;
        }
        return caches.match(isApp ? 'app.html' : 'index.html').then(hit => hit || r);
      }).catch(() => caches.match(isApp ? 'app.html' : 'index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('app.html');
    })
  );
});
