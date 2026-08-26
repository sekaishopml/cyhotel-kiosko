// Transiciones sutiles y calmadas para tercera edad.
// Duración 0.35–0.5s, ease suave de salida. Respeta prefers-reduced-motion.

export const EASE = [0.22, 1, 0.36, 1] as const

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Transición de pantalla genérica (entra desde abajo, sale hacia arriba)
export const screen = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.4, ease: EASE },
}

// Transición de pantalla con deslizamiento horizontal (RoomScreen)
export const screenRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.4, ease: EASE },
}

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: EASE },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

export const scaleOnTap = {
  whileTap: { scale: 0.96 },
  transition: { type: 'spring', stiffness: 400, damping: 17 },
}

// Modal: pop suave con spring (sin rebote fuerte)
export const modalPop = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { type: 'spring', stiffness: 260, damping: 22 },
}

// Barra inferior (Total + Continuar): sube desde abajo
export const slideUpBar = {
  initial: { y: 80, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 80, opacity: 0 },
  transition: { duration: 0.35, ease: EASE },
}
