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

export interface Plan {
  key: string
  name: string
  badge?: string
  hero: boolean
}

export type AppScreen = 'splash' | 'plan' | 'room' | 'checkin'
