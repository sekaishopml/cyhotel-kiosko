/** Hotel del Valle — Branding único
 * Fuente: docs/brand/DECISION.md + docs/brand/01_estrategia_marca.md
 * Usar este módulo como single source en kiosco, admin, master y API.
 */

export const BRAND = {
  hotel: 'Hotel Del Valle',
  // Recomendado por 01_estrategia_marca.md; legacy "Tu descanso, tu espacio" queda como fallback en DEFAULT_CONFIG
  tagline: 'Descanso elegante, trato de casa.',
} as const

export interface PlanDef {
  key: string
  name: string
  badge?: string
  hero?: boolean
}

export const PLANS: PlanDef[] = [
  { key: 'momento', name: 'Momento', badge: 'El más pedido', hero: true },
  { key: 'amanecida', name: 'Amanecida' },
  { key: 'hospedaje', name: 'Hospedaje' },
  { key: 'suite', name: 'Suite Jacuzzi' },
]

export const DEFAULT_CONFIG = {
  max_days: 7,
  max_days_full: 15,
  qr_url: '',
  idle_timeout_seconds: 60,
  promos: [{ title: 'Amanecida 18:00-09:00', subtitle: 'Desde $20' }] as { title: string; subtitle: string }[],
  price_overrides: {} as Record<string, unknown>,
  branding: { hotel: BRAND.hotel, tagline: BRAND.tagline },
  suite_durations: { momento: 20, amanecida: 35, hospedaje: 50 } as Record<string, number>,
  // Fase 1N: preparar multi-hotel sin activar
  reserva_tarifa: 0,
  assign_ttl_minutes: 30,
}
