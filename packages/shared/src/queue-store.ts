/** Cola offline unificada — fuente canónica P2 (docs/architecture/pwa-offline.md §5).
 *
 * Contiene tipos `OrderPayload`, cola localStorage defensiva (cap 50 FIFO,
 * TTL 24h) y persistencia IndexedDB con fallback a localStorage.
 * Sin dependencias; solo API IndexedDB básica (callbacks), apta para
 * WebView Android 8 (Chromium 69+).
 */

export interface OrderPayload {
  product: string
  room_type: string
  guest_name: string
  id_document?: string
  client_ref: string
  extra?: string
  days?: number
}

export interface OrderResult {
  order: {
    id: string
    room_number: string
    check_in: string
    check_out: string
    subtotal: number
  }
}

export type QueuedOrder = OrderPayload & { queuedAt: number }

export const QUEUE_KEY = 'kiosko_offline_queue'
export const QUEUE_CAP = 50
export const QUEUE_TTL_MS = 24 * 60 * 60 * 1000

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export function defaultStorage(): StorageLike | null {
  try {
    const s = (globalThis as unknown as { localStorage?: StorageLike }).localStorage
    return s ?? null
  } catch {
    return null
  }
}

export function isExpired(queuedAt: unknown, now: number = Date.now()): boolean {
  return typeof queuedAt === 'number' && now - queuedAt >= QUEUE_TTL_MS
}

// Validación de forma mínima de OrderPayload: entradas inválidas se descartan
// (no pueden expirar ni enviarse, y atascarían la cola como poison-pill).
export function isQueuedOrder(e: unknown): e is QueuedOrder {
  if (typeof e !== 'object' || e === null) return false
  const o = e as Record<string, unknown>
  return (
    typeof o.queuedAt === 'number' &&
    typeof o.product === 'string' && o.product.length > 0 &&
    typeof o.room_type === 'string' && o.room_type.length > 0 &&
    typeof o.guest_name === 'string' && o.guest_name.length > 0 &&
    typeof o.client_ref === 'string' && o.client_ref.length > 0
  )
}

// Lectura defensiva: JSON corrupto / storage no disponible (modo privado,
// quota) nunca debe romper el flujo de check-in. Cola corrupta → [].
export function readQueue(storage?: StorageLike | null): QueuedOrder[] {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return []
  try {
    const raw = store.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isQueuedOrder)
  } catch {
    return []
  }
}

// Escritura best-effort: ante QuotaExceeded, un reintento con los últimos 50;
// nunca lanza.
export function writeQueue(queue: QueuedOrder[], storage?: StorageLike | null): boolean {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return false
  try {
    store.setItem(QUEUE_KEY, JSON.stringify(queue))
    return true
  } catch {
    try {
      store.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_CAP)))
      return true
    } catch {
      return false
    }
  }
}

// Firma canónica P2: (payload: OrderPayload) => void. Los adaptadores
// (kiosco) añaden verificación de persistencia / espejo IndexedDB.
export function enqueueOrder(payload: OrderPayload, storage?: StorageLike | null): void {
  const now = Date.now()
  const valid = readQueue(storage).filter(q => !isExpired(q.queuedAt, now))
  while (valid.length >= QUEUE_CAP) valid.shift() // FIFO: descarta el más antiguo
  valid.push({ ...payload, queuedAt: now })
  writeQueue(valid, storage)
}

// --- IndexedDB (durable) con fallback a localStorage -------------------------

const IDB_NAME = 'cyhotel-kiosco'
const IDB_VERSION = 1
const IDB_STORE = 'kv'
const IDB_ROW_KEY = 'offline_queue'

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

let openPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null)
  if (!openPromise) {
    openPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION)
        req.onupgradeneeded = () => {
          try {
            if (!req.result.objectStoreNames.contains(IDB_STORE)) {
              req.result.createObjectStore(IDB_STORE)
            }
          } catch {
            // Sigue a onerror → fallback localStorage.
          }
        }
        req.onsuccess = () => resolve(req.result)
        // onerror / onblocked: no colgar nunca; degradar a localStorage.
        req.onerror = () => { openPromise = null; resolve(null) }
        req.onblocked = () => { openPromise = null; resolve(null) }
      } catch {
        openPromise = null
        resolve(null)
      }
    })
  }
  return openPromise
}

function idbGet(): Promise<QueuedOrder[] | null> {
  return openDb().then(db => {
    if (!db) return null
    return new Promise<QueuedOrder[] | null>(resolve => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly')
        const store = tx.objectStore(IDB_STORE)
        const req = store.get(IDB_ROW_KEY)
        req.onsuccess = () => {
          const val: unknown = req.result
          if (!Array.isArray(val)) {
            resolve(val === undefined ? [] : null)
            return
          }
          resolve(val.filter(isQueuedOrder))
        }
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  })
}

function idbSet(queue: QueuedOrder[]): Promise<boolean> {
  return openDb().then(db => {
    if (!db) return false
    return new Promise<boolean>(resolve => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).put(queue, IDB_ROW_KEY)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
        tx.onabort = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
  })
}

// Fusiona IndexedDB + localStorage por client_ref (ordena por queuedAt).
// Cura divergencias (p. ej. espejo async aún no completado, múltiples tabs).
export function mergeQueues(a: QueuedOrder[], b: QueuedOrder[]): QueuedOrder[] {
  const byRef = new Map<string, QueuedOrder>()
  for (const q of [...a, ...b]) {
    const prev = byRef.get(q.client_ref)
    if (!prev || q.queuedAt > prev.queuedAt) byRef.set(q.client_ref, q)
  }
  return [...byRef.values()]
    .sort((x, y) => x.queuedAt - y.queuedAt)
    .slice(-QUEUE_CAP)
}

// Lectura unificada: IndexedDB primero, localStorage como fallback y fuente
// de migración (primera ejecución tras P2 siembra IndexedDB desde LS).
export async function loadQueue(storage?: StorageLike | null): Promise<QueuedOrder[]> {
  const ls = readQueue(storage)
  if (!isIndexedDbAvailable()) return ls
  let idb: QueuedOrder[] | null = null
  try {
    idb = await idbGet()
  } catch {
    idb = null
  }
  if (idb === null) return ls // IDB ilegible → solo LS (nunca romper)
  if (idb.length === 0 && ls.length > 0) {
    try { await idbSet(ls) } catch { /* best-effort */ }
    return ls
  }
  const merged = mergeQueues(idb, ls)
  if (merged.length !== idb.length || merged.length !== ls.length) {
    // Divergencia curada: persiste la fusión en ambos backends.
    try { await saveQueue(merged, storage) } catch { /* best-effort */ }
  }
  return merged
}

// Escritura unificada: localStorage síncrono (rápido) + IndexedDB durable.
// Devuelve true si persistió en al menos un backend.
export async function saveQueue(queue: QueuedOrder[], storage?: StorageLike | null): Promise<boolean> {
  const lsOk = writeQueue(queue, storage)
  let idbOk = false
  try {
    idbOk = await idbSet(queue)
  } catch {
    idbOk = false
  }
  return lsOk || idbOk
}

// Espejo fire-and-forget para el path síncrono enqueueOrder→boolean:
// localStorage ya persistió; IndexedDB se actualiza sin bloquear.
export function mirrorQueueToIdb(queue: QueuedOrder[]): void {
  if (!isIndexedDbAvailable()) return
  try {
    void idbSet(queue).catch(() => {})
  } catch {
    // best-effort: nunca romper el check-in
  }
}
