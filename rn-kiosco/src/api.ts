export type ExtraEntry = {
  key: string;
  label: string;
  price: number;
};

export type RoomType = {
  key: string;
  label: string;
  desc: string;
  photo: string;
  price: number | null;
  free: number;
  eligible: boolean;
  reason: string | null;
  extras: Record<string, ExtraEntry>;
};

export type TypesResponse = {
  product: string;
  types: RoomType[];
};

export type OrderPayload = {
  product: string;
  room_type: string;
  guest_name: string;
  id_document?: string;
  client_ref: string;
  extra?: string;
  days?: number;
};

export type Order = {
  id: number;
  room_number: string;
  room_label: string;
  product_label: string;
  check_in_fmt: string;
  check_out_fmt: string;
  amount: number;
  status: string;
  subtotal: number;
};

export const PLAN_KEYS: Record<string, string> = {
  momento: 'momento',
  amanecida: 'amanecida',
  hospedaje: 'hospedaje',
  suite: 'suite',
};

export const PLAN_META: Record<string, { name: string; subtitle: string; icon: string; hero: boolean; badge?: string }> = {
  momento: {
    name: 'Momento',
    subtitle: 'Por horas, sin complicaciones',
    icon: '⏱',
    hero: true,
    badge: 'El más pedido',
  },
  amanecida: {
    name: 'Amanecida',
    subtitle: 'Desde la tarde hasta la mañana',
    icon: '🌅',
    hero: false,
  },
  hospedaje: {
    name: 'Hospedaje',
    subtitle: 'Estadía por noches',
    icon: '🌙',
    hero: false,
  },
  suite: {
    name: 'Suite Jacuzzi',
    subtitle: 'Lujo y relax con jacuzzi',
    icon: '🛁',
    hero: false,
  },
};

export const PLAN_ORDER = ['momento', 'amanecida', 'hospedaje', 'suite'];

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const SERVER_URL_KEY = 'kiosko_server_url';
const DEFAULT_SERVER = 'http://68.168.20.219:8000';

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getServerBase(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch (_) {}
  return DEFAULT_SERVER;
}

export async function setServerBase(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
}

export function imgUrl(photo: string): string {
  // photo viene como "/img/habitacion.jpeg"; si ya es absoluta se usa directa
  if (photo.startsWith('http')) return photo;
  return photo; // se resuelve relativo al server base
}

export async function getTypes(product: string, base?: string): Promise<TypesResponse> {
  const server = base ?? (await getServerBase());
  const res = await fetch(`${server}/api/types?product=${encodeURIComponent(product)}`);
  if (!res.ok) throw new ApiError(`Error ${res.status}`);
  return (await res.json()) as TypesResponse;
}

export async function createOrder(payload: OrderPayload, base?: string): Promise<Order> {
  const server = base ?? (await getServerBase());
  const res = await fetch(`${server}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.error ?? `Error ${res.status}`);
  }
  const data = await res.json();
  return data.order as Order;
}