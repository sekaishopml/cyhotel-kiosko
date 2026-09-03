const CACHE_NAME = "kiosco-v1.3.0";
const PRECACHE = [
  "./",
  "./index.html",
  "assets/index-ClWMpnXf.js",
  "assets/index-duFtsVh5.css",
  "manifest.webmanifest",
  "icon.svg",
  "assets/cormorantgaramond-Bg62sWL9.woff2",
  "assets/inter-BOeWTOD4.woff2",
  "assets/manrope-DHIcAJRg.woff2",
  "img/habitacion-thumb.webp",
  "img/habitacion.jpeg",
  "img/habitacion.webp",
  "img/suite-thumb.webp",
  "img/suite.jpeg",
  "img/suite.webp"
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
  const url = new URL(event.request.url);

  // NetworkOnly for API — nunca cachear respuestas de /api/* (riesgo stale + datos sensibles)
  // También excluye cualquier URL que contenga /api/ (por si API_BASE es cross-origin)
  if (url.pathname.startsWith('/api') || url.href.includes('/api/')) {
    return;
  }

  // Navigation (document): NetworkFirst -> cache -> offline fallback
  // Garantiza HTML fresco cuando hay red, pero sirve shell offline si falla
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // solo cachear navigations exitosas
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html') || caches.match('/kiosco/index.html')))
    );
    return;
  }

  // Assets (js/css/img/font/svg): CacheFirst -> network -> cache.put
  // Óptimo para shell offline; /uploads/* (imágenes de habitaciones) también se beneficia
  // de CacheFirst — sirve imagen cacheada offline, pero se actualiza en background si hay red.
  // Decisión documentada: /api NUNCA se cachea; /uploads SÍ se cachea vía CacheFirst (no NetworkOnly)
  // porque mostrar imagen stale offline es mejor que hueco; el backend versiona imágenes por URL.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // solo cachear respuestas válidas same-origin (type basic) o CORS ok
          // no cachear opaque ni errores para evitar envenenar cache
          if (response && response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          } else if (response && response.ok && response.type === 'cors') {
            // ej. fuentes opcionales — cachear solo si es 200
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    })
  );
});
