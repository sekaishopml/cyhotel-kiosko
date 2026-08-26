import { createOrder, type OrderPayload, type OrderResult } from '../api/client'

// Cola offline: si el backend no responde, guardamos la reserva en el tablet
// (localStorage) y la reintentamos automáticamente cuando vuelva la conexión.
// Así el hotel no pierde check-ins aunque se caiga la red (24/7).

const KEY = 'kiosco_pending_orders'

export interface PendingOrder extends OrderPayload {
  _ts: number
}

function read(): PendingOrder[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function write(list: PendingOrder[]) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function enqueueOrder(o: OrderPayload): PendingOrder {
  const item: PendingOrder = { ...o, _ts: Date.now() }
  const list = read()
  list.push(item)
  write(list)
  return item
}

export function pendingCount(): number {
  return read().length
}

export function clearOrder(ts: number) {
  write(read().filter(o => o._ts !== ts))
}

// Intenta enviar todas las pendientes. Devuelve cuántas se sincronizaron.
export async function syncPending(): Promise<number> {
  const list = read()
  if (list.length === 0) return 0
  let synced = 0
  for (const o of list) {
    try {
      await createOrder(o)
      clearOrder(o._ts)
      synced++
    } catch {
      // sigue pendiente; se reintenta luego
    }
  }
  return synced
}
