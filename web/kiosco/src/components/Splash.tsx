import { useEffect } from 'react'

interface Props {
  onDone: () => void
}

export default function Splash({ onDone }: Props) {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(onDone, prefersReduced ? 800 : 1500)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="h-full flex flex-col items-center justify-center bg-navy">
      <h1 className="font-display text-[length:var(--fs-display)] text-white font-bold tracking-wide animate-breathe">
        Hotel Del Valle
      </h1>
      <p className="mt-3 text-white/50 text-[length:var(--fs-small)] font-semibold tracking-widest uppercase">
        Kiosco
      </p>
    </div>
  )
}
