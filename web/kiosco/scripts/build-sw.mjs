import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))

const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf-8')
const extra = ['manifest.webmanifest', 'icon.svg'].filter(f => {
  try { readFileSync(resolve(dist, f)); return true } catch { return false }
})
const assets = [
  ...[...indexHtml.matchAll(/(?:href|src)="([^"]+\.(?:js|css|woff2))"/g)].map(m => m[1].replace(/^\.\//, '')).filter(a => a.startsWith('assets/')),
  ...extra,
]
const precache = ['./', './index.html', ...assets]

const cacheName = `kiosco-v${pkg.version}`

const sw = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(precache, null, 2)};

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
`

writeFileSync(resolve(dist, 'sw.js'), sw)
console.log(`[build-sw] generado ${cacheName} con ${precache.length} recursos precacheados`)