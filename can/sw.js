// Service worker: giữ sẵn vỏ app (mở tức thì, không giật, không cần F5). Không đụng tới lệnh gọi Google.
var C = 'shell-v1';
var FILES = ['./', './index.html', '../shell.js', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // Google API: đi thẳng mạng
  // Cache trước, mạng cập nhật ngầm (lần mở sau có bản mới)
  e.respondWith(caches.open(C).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (r) { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
