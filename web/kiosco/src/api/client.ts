export interface TypeOption {
  key: string
  label: string
  desc: string
  photo: string
  price: number
  free: boolean
  eligible: boolean
  reason: string
  extras: Record<string, { label: string; price: number }>
}

export interface TypesResponse {
  product: string
  types: TypeOption[]
}

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
    amount: number
  }
}

// Base configurable: se usa para que la UI funcione tanto servida por el server
// (misma origen) como empaquetada localmente en el APK (file://) apuntando al backend.
// Prioridad: window.__API_BASE__ (inyectado por el shell con ?api=) > VITE_API_BASE > "" (same-origin)
function resolveApiBase(): string {
  const w = typeof window !== 'undefined' ? (window as any) : undefined
  const fromWindow = w && w.__API_BASE__
  const fromEnv = (import.meta.env as any).VITE_API_BASE
  const base = (fromWindow || fromEnv || '').trim()
  return base.replace(/\/+$/, '')
}

export const API_BASE = resolveApiBase()

export async function getTypes(product: string): Promise<TypesResponse> {
  const res = await fetch(`${API_BASE}/api/types?product=${encodeURIComponent(product)}`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export async function createOrder(payload: OrderPayload): Promise<OrderResult> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json()
}

export function imgUrl(photo: string): string {
  return `${API_BASE}/img/${photo}`
}
