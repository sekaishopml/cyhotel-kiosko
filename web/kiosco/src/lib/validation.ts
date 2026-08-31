import { z } from 'zod'

export const nameSchema = z.string().trim().min(2, 'Escriba su nombre').max(40)

export const docSchema = z
  .string()
  .trim()
  .optional()
  .refine(v => !v || /^[0-9]{10}$/.test(v), 'Documento inválido')

export const nameSchemaSafe = nameSchema.safeParse
