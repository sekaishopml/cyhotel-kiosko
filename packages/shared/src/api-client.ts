/** API client compartido — kiosco, admin, master (fuente única P2).
 *
 * Unifica `web/kiosco/src/api.ts` (P1d) según docs/architecture/pwa-offline.md §5:
 * - `API_BASE`/`resolveApiBase`: única fuente aquí; el kiosco re-exporta.
 * - `retryFetch`: NO reintenta 4xx salvo 408/429 (sí 5xx y red/timeout).
 * - Cola offline: ver `./queue-store` (tipos `OrderPayload`, cap 50, TTL 24h,
 *   IndexedDB con fallback). `syncPending` con `createOrder` inyectado
 *   (testeable, reutilizable admin/master) + dead-letter 4xx.
 * - Cachés TTL de `getTypes`/config: kiosco-only (documentado en
 *   pwa-offline.md §5), no se mueven aquí.
 */

import {
  isExpired,
  loadQueue,
  saveQueue,
  type OrderPayload,
  type QueuedOrder,
} from './queue-store'

export type { OrderPayload, OrderResult, QueuedOrder } from './queue-store'

export function resolveApiBase(): string {
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined
  const fromWindow = w?.__API_BASE__ as string | undefined
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE
  const fromStorage = (() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('kiosco_server') : null
    } catch {
      return null
    }
  })()
  return (fromWindow || fromEnv || fromStorage || '').trim().replace(/\/+$/, '')
}

export const API_BASE = resolveApiBase()

const TIMEOUT = 8000

export async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function statusOf(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status
  if (typeof err === 'object' && err !== null) {
    const s = (err as Record<string, unknown>).status
    if (typeof s === 'number') return s
  }
  return undefined
}

/** true si el fallo es reintentable: red/timeout (sin status), 5xx, 408, 429.
 * 4xx definitivo (validación, duplicado, etc.) → dead-letter, no reintentar. */
export function isRetryableStatus(status?: number): boolean {
  if (status === undefined) return true
  if (status === 408 || status === 429) return true
  return status < 400 || status >= 500
}

/** Reintenta solo red/timeout, 5xx y 408/429; 4xx definitivo se retorna sin
 * reintentar (ahorra reintentos inútiles en POST /api/orders). */
export async function retryFetch(url: string, opts: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, opts)
      if (res.ok || !isRetryableStatus(res.status) || i === attempts - 1) return res
      // 5xx / 408 / 429 → reintenta con backoff
    } catch (err) {
      lastError = err as Error
      if (i === attempts - 1) throw lastError
    }
    await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
  }
  throw lastError ?? new Error('retryFetch failed')
}

export function imgUrl(photo: string): string {
  return `${API_BASE}/img/${photo}`
}

export interface SyncPendingOptions {
  storage?: import('./queue-store').StorageLike | null
}

/** Envía la cola en orden (stop-on-first-failure) con `createOrder` inyectado.
 * - Ítems expirados (>24h) se podan (y se persiste la poda aunque no haya
 *   nada que enviar).
 * - Dead-letter: 4xx salvo 408/429 se descarta para no bloquear pedidos
 *   válidos detrás (poison-pill). Red/5xx/408/429 conservan orden restante. */
export async function syncPending(
  createOrder: (p: OrderPayload) => Promise<unknown>,
  opts: SyncPendingOptions = {},
): Promise<void> {
  const now = Date.now()
  const stored = await loadQueue(opts.storage)
  const valid = stored.filter(q => !isExpired(q.queuedAt, now))
  if (valid.length === 0) {
    // Persiste el descarte de expirados/corruptos aunque no haya nada que enviar.
    if (stored.length !== 0) {
      try { await saveQueue([], opts.storage) } catch { /* best-effort */ }
    }
    return
  }
  const remaining: QueuedOrder[] = []
  let failed = false
  for (const item of valid) {
    if (failed) {
      remaining.push(item)
      continue
    }
    try {
      const { queuedAt: _queuedAt, ...payload } = item
      await createOrder(payload)
    } catch (err) {
      if (!isRetryableStatus(statusOf(err))) {
        continue // dead-letter 4xx definitivo
      }
      remaining.push(item)
      failed = true
    }
  }
  try { await saveQueue(remaining, opts.storage) } catch { /* best-effort */ }
}
