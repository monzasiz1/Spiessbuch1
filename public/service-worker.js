self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('Spiessbuch-v1').then(cache => cache.addAll([
      '/', '/index.html', '/styles.css', '/logo.png'
    ]))
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
