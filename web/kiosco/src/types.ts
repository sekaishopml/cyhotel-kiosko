export interface RoomType {
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
  types: RoomType[]
}

// P2: OrderPayload/OrderResult canónicos en @cyhotel/shared
// (docs/architecture/pwa-offline.md §5). Se re-exportan para compatibilidad
// con los imports existentes desde './types'.
export type { OrderPayload, OrderResult } from '@cyhotel/shared'

export interface Plan {
  key: string
  name: string
  badge?: string
  hero: boolean
}

export type AppScreen = 'splash' | 'plan' | 'room' | 'checkin'
