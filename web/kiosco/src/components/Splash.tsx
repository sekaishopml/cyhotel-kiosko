import { useEffect } from 'react'

interface Props {
  onDone: () => void
}

export default function Splash({ onDone }: Props) {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(onDone, prefersReduced ? 1200 : 2200)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-navy to-[#1a2744] overflow-hidden">
      <h1 className="font-display text-[length:var(--fs-display)] text-white font-bold tracking-wide animate-breathe">
        Hotel Del Valle
      </h1>
      <p className="mt-2 text-gold/70 text-[length:var(--fs-small)] font-semibold tracking-[0.3em] uppercase">
        Kiosco
      </p>
      <div className="mt-8 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full load-bar" />
      </div>
      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2, 3, 4].map(i => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-gold/60"
            style={{ animation: `waitDot 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}
