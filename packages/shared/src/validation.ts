import { z } from 'zod'

/** Nombre: 2-40, trim */
export const nameSchema = z.string().trim().min(2, 'Escriba su nombre').max(40)

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
