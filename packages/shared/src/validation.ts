import { z } from 'zod'

/** Nombre: 2-40, trim */
export const nameSchema = z.string().trim().min(2, 'Escriba su nombre').max(40)

/** Nombre completo (check-in kiosco): nombre + apellido obligatorios.
 *  Acepta 2+ palabras de 2+ letras ("Susana Maria", "Susana Maria Chango");
 *  rechaza una sola palabra ("Susana"). */
export const fullNameSchema = z
  .string()
  .trim()
  .min(3, 'Escriba nombre y apellido')
  .max(60)
  .refine(
    v => {
      const parts = v.split(/\s+/).filter(Boolean)
      return parts.length >= 2 && parts.every(p => p.length >= 2)
    },
    'Escriba nombre y apellido',
  )

/** Documento unificado: vacío (opcional) o CI 6-10 dígitos o Pasaporte 5-9 alfanumérico */
export const docSchema = z
  .string()
  .trim()
  .optional()
  .refine((v: string | undefined) => !v || /^[0-9]{6,10}$/.test(v) || /^[A-Z0-9]{5,9}$/i.test(v), 'Documento inválido (CI 6-10 dígitos o Pasaporte 5-9)')

export function validateDoc(value: string, type: 'ci' | 'passport'): boolean {
  const v = value.trim()
  if (!v) return true
  return type === 'ci' ? /^[0-9]{6,10}$/.test(v) : /^[A-Z0-9]{5,9}$/i.test(v)
}
