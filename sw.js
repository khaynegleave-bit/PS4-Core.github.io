const CACHE = 'ps4core-v2';
const ASSETS = ['/', '/index.html', '/style.css', '/script.js'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
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
    if (e.request.method !== 'GET') return;
    if (e.request.url.includes('api.real-debrid.com') || e.request.url.includes('raw.githubusercontent.com')) return;
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
    );
});
