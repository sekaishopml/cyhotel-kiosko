const CACHE_NAME = "kiosco-v1.2.3";
const PRECACHE = [
  "./",
  "./index.html",
  "assets/index-Bl7e3nj0.js",
  "assets/index-8gHDfLil.css",
  "manifest.webmanifest",
  "icon.svg",
  "assets/cormorantgaramond-Bg62sWL9.woff2",
  "assets/inter-BOeWTOD4.woff2",
  "img/habitacion.jpeg",
  "img/suite.jpeg"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
