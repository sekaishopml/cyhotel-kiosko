import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { checkVersion } from './api'
import { isNewer } from './lib/version'

const LOCAL_VERSION: string = import.meta.env.PACKAGE_VERSION || '1.3.0'
const SW_UPDATE_EVENT = 'kiosco:sw-updated'
// Poll ligero: cubre shell web stale (el SW usa skipWaiting y se activa solo,
// pero la vista ya cargada sigue vieja hasta recargar).
const POLL_MS = 5 * 60 * 1000

function notifySwUpdated(): void {
  window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT))
}

async function snapshotCaches(): Promise<string[]> {
  try {
    if ('caches' in window) return await caches.keys()
    return []
  } catch {
    return []
  }
}

// PWA offline (P1d): registro del SW generado por scripts/build-sw.mjs con scope
// explícito /kiosco/ — idéntico al scope por defecto del script, no cambia lógica.
// /api/* es NetworkOnly (nunca cacheado); detalle en docs/architecture/pwa-offline.md.
if ('serviceWorker' in navigator) {
  let knownCaches: string[] | null = null
  snapshotCaches().then((keys) => { knownCaches = keys })

  const watchForActivation = (worker: ServiceWorker | null) => {
    if (!worker) return
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'activated') return
      // Sin controlador previo es primera instalación (nada stale que avisar).
      if (!navigator.serviceWorker.controller) return
      snapshotCaches().then((keys) => {
        const prev = knownCaches
        knownCaches = keys
        // Avisar solo si el CACHE cambió (vista realmente nueva).
        if (!prev || prev.length !== keys.length || keys.some((k) => !prev.includes(k))) {
          notifySwUpdated()
        }
      })
    })
  }

  navigator.serviceWorker.register('/kiosco/sw.js', { scope: '/kiosco/' }).then((reg) => {
    if (reg.installing) watchForActivation(reg.installing)
    if (reg.waiting) watchForActivation(reg.waiting)
    reg.addEventListener('updatefound', () => watchForActivation(reg.installing))

    const poll = () => {
      reg.update().catch(() => {})
      void checkVersion().then((info) => {
        if (info && isNewer(info.version, LOCAL_VERSION)) notifySwUpdated()
      })
    }
    poll()
    window.setInterval(poll, POLL_MS)
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
