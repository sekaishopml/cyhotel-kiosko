/**
 * Hotel del Valle — Validación (Fase 4)
 * Single source: @cyhotel/shared/validation
 * Re-exporta desde shared; mantiene compatibilidad con nameSchemaSafe.
 * Fallback: la validación local antigua usaba /^[0-9]{10}$/ para CI;
 *           shared unifica a 6-10 dígitos CI + 5-9 alfanumérico pasaporte.
 */
export { nameSchema, docSchema, validateDoc } from '@cyhotel/shared/validation'
import { nameSchema } from '@cyhotel/shared/validation'

export const nameSchemaSafe = nameSchema.safeParse.bind(nameSchema)
