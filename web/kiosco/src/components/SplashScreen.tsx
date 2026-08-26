import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { splashBreathe, splashExit, prefersReducedMotion } from '../lib/animations'

interface SplashScreenProps {
  onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const reduced = prefersReducedMotion()

  useEffect(() => {
    const id = setTimeout(onDone, reduced ? 800 : 1500)
    return () => clearTimeout(id)
  }, [onDone, reduced])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-verde-900"
        {...splashExit}
      >
        <motion.h1
          className="font-display text-white text-[3rem] tracking-[0.06em]"
          {...(reduced ? {} : splashBreathe)}
        >
          Hotel del Valle
        </motion.h1>
        <span className="font-sans text-white/70 text-sm mt-3 tracking-wider">
          Kiosco
        </span>
      </motion.div>
    </AnimatePresence>
  )
}
