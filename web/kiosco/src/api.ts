import { TypesResponse, OrderPayload, OrderResult } from './types'
import { DEFAULT_CONFIG } from './constants'
import {
  API_BASE,
  ApiError,
  fetchWithTimeout,
  isExpired as isQueueExpired,
  mirrorQueueToIdb,
  QUEUE_CAP,
  readQueue as readSharedQueue,
  retryFetch,
  syncPending as syncPendingShared,
  writeQueue as writeSharedQueue,
} from '@cyhotel/shared'

// P2 (docs/architecture/pwa-offline.md §5): fuente única en @cyhotel/shared.
// Se re-exporta para compatibilidad con los imports existentes.
export { API_BASE, ApiError, fetchWithTimeout, imgUrl, retryFetch } from '@cyhotel/shared'

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
  if (!res.ok) throw new ApiError(`Error ${res.status}`, res.status)
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

export interface KioscoUpdateInfo {
  version: string
  download_url: string
  sha256: string
  size: number
  minVersion?: string
}

export async function checkVersion(): Promise<KioscoUpdateInfo | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/kiosco-update`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || typeof data.version !== 'string' || !data.version) return null
    const info: KioscoUpdateInfo = {
      version: data.version,
      download_url: typeof data.download_url === 'string' ? data.download_url : '',
      sha256: typeof data.sha256 === 'string' ? data.sha256 : '',
      size: typeof data.size === 'number' ? data.size : 0,
    }
    if (typeof data.minVersion === 'string' && data.minVersion) {
      info.minVersion = data.minVersion
    }
    return info
  } catch {
    return null
  }
}

// Cola offline P2: lectura/escritura defensiva + tipos desde @cyhotel/shared
// (cap 50 FIFO, TTL 24h, dead-letter 4xx en syncPending). Persistencia
// IndexedDB con fallback a localStorage (ver queue-store): el path síncrono
// escribe localStorage y espeja a IndexedDB sin bloquear; syncPending lee la
// vista unificada (fusión por client_ref).
export function enqueueOrder(payload: OrderPayload): boolean {
  const now = Date.now()
  const valid = readSharedQueue().filter(q => !isQueueExpired(q.queuedAt, now))
  while (valid.length >= QUEUE_CAP) valid.shift() // FIFO: descarta el más antiguo
  valid.push({ ...payload, queuedAt: now })
  if (!writeSharedQueue(valid)) return false
  mirrorQueueToIdb(valid)
  // Verifica persistencia real (modo privado/quota pueden fallar en silencio).
  return readSharedQueue().some(q => q.client_ref === payload.client_ref)
}

export async function syncPending(): Promise<void> {
  // Inyección P2 (§5): el cliente compartido recibe createOrder; la firma
  // pública sin argumentos se mantiene (App.tsx y CheckinScreen intactos).
  return syncPendingShared(createOrder)
}
