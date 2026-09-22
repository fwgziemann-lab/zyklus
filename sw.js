/*
 * Zyklus – Service Worker
 * Sorgt dafür, dass die App auch ohne Internet öffnet (Offline-Eintragen).
 * Strategie: erst Netz, bei Fehler Cache. Neue Versionen erscheinen so
 * direkt beim nächsten Laden mit Verbindung. Es werden nur eigene Dateien
 * gecacht, nie Google-Antworten oder Nutzerdaten.
 */
const CACHE = 'zyklus-shell-v4';
const SHELL = ['./', './index.html', './core.js', './crypto.js', './app.js', './stats.js', './icon.svg', './icon-180.png', './manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // Google & Co. nie anfassen
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) { return hit || caches.match('./index.html'); });
    })
  );
});
