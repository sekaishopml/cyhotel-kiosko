import { TypesResponse, OrderPayload, OrderResult } from './types'

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
  const res = await retryFetch(`${API_BASE}/api/types?product=${encodeURIComponent(product)}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
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
