/** Pricing único — usar en kiosco, admin y backend (port Python en Fase 3).
 * Unifica RoomScreen y lib/pricing.ts que divergían en suite extras.
 */

export const DEFAULT_PRICES: Record<string, Record<string, number>> = {
  momento: { estandar: 10, matrimonial: 12, doble: 12 },
  amanecida: { estandar: 20, matrimonial: 20, doble: 30 },
  hospedaje: { estandar: 30, matrimonial: 30, doble: 40 },
}

export const DEFAULT_SUITE: Record<string, number> = { momento: 20, amanecida: 35, hospedaje: 50 }

export interface RoomLite {
  key: string
  price: number
  extras?: Record<string, { label: string; price: number }>
}

export function computeTotal(
  planKey: string,
  roomKey: string,
  extraKey: string | null,
  days: number,
  catalog: RoomLite[] | null,
): number {
  const room = catalog?.find(r => r.key === roomKey)

  if (planKey === 'hospedaje') {
    const price = room?.price ?? DEFAULT_PRICES.hospedaje[roomKey] ?? 0
    return price * days
  }

  if (planKey === 'suite' && extraKey) {
    if (room?.extras?.[extraKey]) return room.extras[extraKey].price
    const suiteRoom = catalog?.find(r => r.key === 'suite')
    if (suiteRoom?.extras?.[extraKey]) return suiteRoom.extras[extraKey].price
    return DEFAULT_SUITE[extraKey] ?? 0
  }

  const price = room?.price ?? DEFAULT_PRICES[planKey]?.[roomKey] ?? 0
  const extra = extraKey ? (room?.extras?.[extraKey]?.price ?? DEFAULT_SUITE[extraKey] ?? 0) : 0
  return price + extra
}
