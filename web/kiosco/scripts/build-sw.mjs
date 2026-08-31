import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      walk(p, acc)
    } else {
      acc.push(p.replace(dist + '/', ''))
    }
  }
  return acc
}

const staticFiles = walk(dist).filter(f => /\.(jpe?g|png|webp|svg|ico|woff2)$/i.test(f))

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))

const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf-8')
const extra = ['manifest.webmanifest', 'icon.svg'].filter(f => {
  try { readFileSync(resolve(dist, f)); return true } catch { return false }
})
const assets = [
  ...[...indexHtml.matchAll(/(?:href|src)="([^"]+\.(?:js|css|woff2))"/g)].map(m => m[1].replace(/^\.\//, '')).filter(a => a.startsWith('assets/')),
  ...extra,
  ...staticFiles,
]
const precache = ['./', './index.html', ...[...new Set(assets)]]

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