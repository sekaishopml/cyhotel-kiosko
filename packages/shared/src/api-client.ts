/** API client compartido — kiosco, admin, master.
 * Mejora api.ts: retry solo 5xx/timeout, no 4xx; TTLs; offline queue con cap.
 */

export function resolveApiBase(): string {
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined
  const fromWindow = w?.__API_BASE__ as string | undefined
  const fromEnv = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_BASE
  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('kiosco_server') : null
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

/** Reintenta solo en errores de red/timeout o 5xx; no reintenta 4xx */
export async function retryFetch(url: string, opts: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(url, opts)
      if (res.status >= 400 && res.status < 500) return res
      if (res.ok || i === attempts - 1) return res
      // 5xx → retry
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

// Offline queue — cap 50, TTL 24h (Fase 4 migrará a IndexedDB)
const QUEUE_KEY = 'kiosko_offline_queue'
const QUEUE_CAP = 50
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000

export function enqueueOrder(payload: Record<string, unknown>): void {
  const raw = localStorage.getItem(QUEUE_KEY)
  const queue: Array<Record<string, unknown> & { queuedAt: number }> = raw ? JSON.parse(raw) : []
  const now = Date.now()
  const filtered = queue.filter(q => now - q.queuedAt < QUEUE_TTL_MS)
  if (filtered.length >= QUEUE_CAP) filtered.shift()
  filtered.push({ ...payload, queuedAt: now })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered))
}

export async function syncPending(createOrder: (p: Record<string, unknown>) => Promise<unknown>): Promise<void> {
  const raw = localStorage.getItem(QUEUE_KEY)
  if (!raw) return
  const queue = JSON.parse(raw) as Array<Record<string, unknown> & { queuedAt: number }>
  if (queue.length === 0) return
  const now = Date.now()
  const valid = queue.filter(q => now - q.queuedAt < QUEUE_TTL_MS)
  const remaining: typeof valid = []
  for (const item of valid) {
    try {
      const { queuedAt: _qa, ...payload } = item
      await createOrder(payload)
    } catch {
      remaining.push(item)
      break // stop-on-first-failure, preserva orden
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
}
