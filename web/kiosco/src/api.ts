import { TypesResponse, OrderPayload, OrderResult } from './types'
import { DEFAULT_CONFIG } from './constants'

export interface KioscoConfig {
  max_days: number
  max_days_full: number
  qr_url: string
  idle_timeout_seconds: number
  promos: { title: string; subtitle: string }[]
  price_overrides: Record<string, unknown>
  branding: { hotel: string; tagline: string }
  suite_durations: Record<string, number>
}

function resolveApiBase(): string {
  const w = typeof window !== 'undefined' ? (window as any) : undefined
  const fromWindow = w && w.__API_BASE__
  const fromEnv = (import.meta.env as any).VITE_API_BASE
  const fromStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('kiosco_server') : null
  return (fromWindow || fromEnv || fromStorage || '').trim().replace(/\/+$/, '')
}

export const API_BASE = resolveApiBase()

const TIMEOUT = 8000

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function retryFetch(url: string, opts: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchWithTimeout(url, opts)
    } catch (err) {
      lastError = err as Error
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
      }
    }
  }
  throw lastError
}

export async function getTypes(product: string): Promise<TypesResponse> {
  const cached = getTypesCache.get(product)
  if (cached) return cached
  const res = await retryFetch(`${API_BASE}/api/types?product=${encodeURIComponent(product)}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  const data: TypesResponse = await res.json()
  getTypesCache.set(product, data)
  return data
}

const TYPES_TTL = 60_000

export const getTypesCache = (() => {
  const store = new Map<string, { value: TypesResponse; at: number }>()
  return {
    get(product: string): TypesResponse | undefined {
      const e = store.get(product)
      if (!e) return undefined
      if (Date.now() - e.at > TYPES_TTL) {
        store.delete(product)
        return undefined
      }
      return e.value
    },
    set(product: string, value: TypesResponse): void {
      store.set(product, { value, at: Date.now() })
    },
    clear(): void {
      store.clear()
    },
  }
})()

const CONFIG_TTL = 5 * 60_000
let configCacheEntry: { value: KioscoConfig; at: number } | null = null

export async function getKioscoConfig(): Promise<KioscoConfig> {
  if (configCacheEntry && Date.now() - configCacheEntry.at < CONFIG_TTL) {
    return configCacheEntry.value
  }
  try {
    const res = await retryFetch(`${API_BASE}/api/kiosco-config`)
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const data = await res.json()
    const merged: KioscoConfig = {
      ...DEFAULT_CONFIG,
      ...(data?.config || {}),
      promos: data?.config?.promos?.length ? data.config.promos : DEFAULT_CONFIG.promos,
      branding: { ...DEFAULT_CONFIG.branding, ...(data?.config?.branding || {}) },
      suite_durations: { ...DEFAULT_CONFIG.suite_durations, ...(data?.config?.suite_durations || {}) },
    }
    configCacheEntry = { value: merged, at: Date.now() }
    return merged
  } catch {
    return DEFAULT_CONFIG
  }
}

export function clearKioscoConfigCache(): void {
  configCacheEntry = null
}

export async function createOrder(payload: OrderPayload): Promise<OrderResult> {
  const res = await retryFetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/health`)
    return res.ok
  } catch {
    return false
  }
}

export async function checkVersion(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/kiosco-version`)
    if (!res.ok) return null
    const data = await res.json()
    return data.version || null
  } catch {
    return null
  }
}

export function imgUrl(photo: string): string {
  return `${API_BASE}/img/${photo}`
}

// Offline queue
const QUEUE_KEY = 'kiosko_offline_queue'

export function enqueueOrder(payload: OrderPayload): void {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  queue.push({ ...payload, queuedAt: Date.now() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function syncPending(): Promise<void> {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  if (queue.length === 0) return
  const remaining: typeof queue = []
  for (const item of queue) {
    try {
      const { queuedAt, ...payload } = item
      await createOrder(payload)
    } catch {
      remaining.push(item)
      break
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
}
