import { Plan } from './types'
// Fase 3: fuente única en @cyhotel/shared/branding (ver packages/shared). Este archivo
// mantiene compat para build actual; en Fase 4 se cambiará a `export * from '@cyhotel/shared/branding'`
export const BRAND = {
  hotel: 'Hotel Del Valle',
  tagline: 'Descanso elegante, trato de casa.',
}

export const PLANS: Plan[] = [
  { key: 'momento', name: 'Momento', badge: 'El más pedido', hero: true },
  { key: 'amanecida', name: 'Amanecida', hero: false },
  { key: 'hospedaje', name: 'Hospedaje', hero: false },
  { key: 'suite', name: 'Suite Jacuzzi', hero: false },
]

export const DEFAULT_CONFIG = {
  max_days: 7,
  max_days_full: 15,
  qr_url: '',
  idle_timeout_seconds: 60,
  promos: [
    { title: 'Amanecida 18:00-09:00', subtitle: 'Desde $20' },
  ] as { title: string; subtitle: string }[],
  price_overrides: {} as Record<string, unknown>,
  branding: { hotel: 'Hotel Del Valle', tagline: 'Descanso elegante, trato de casa.' },
  suite_durations: { momento: 20, amanecida: 35, hospedaje: 50 } as Record<string, number>,
}
