/**
 * Hotel del Valle — Pricing (Fase 4)
 * Single source: @cyhotel/shared/pricing
 * Re-exporta desde shared para mantener compatibilidad hacia atrás.
 * Fallback: constantes locales comentadas abajo por si el alias vite falla en un entorno sin build.
 */
import type { RoomType } from '../types'
import type { RoomLite } from '@cyhotel/shared/pricing'

export { DEFAULT_PRICES, DEFAULT_SUITE } from '@cyhotel/shared/pricing'
import { computeTotal as sharedComputeTotal } from '@cyhotel/shared/pricing'

export function computeTotal(
  planKey: string,
  roomKey: string,
  extraKey: string | null,
  days: number,
  catalog: RoomType[] | null,
): number {
  // RoomType es superset de RoomLite (key, price, extras) — cast seguro
  return sharedComputeTotal(planKey, roomKey, extraKey, days, catalog as unknown as RoomLite[] | null)
}

// Fallback local (no se ejecuta si shared está disponible; se mantiene para referencia/offline):
// export const DEFAULT_PRICES: Record<string, Record<string, number>> = {
//   momento: { estandar: 10, matrimonial: 12, doble: 12 },
//   amanecida: { estandar: 20, matrimonial: 20, doble: 30 },
//   hospedaje: { estandar: 30, matrimonial: 30, doble: 40 },
// }
// export const DEFAULT_SUITE: Record<string, number> = { momento: 20, amanecida: 35, hospedaje: 50 }
