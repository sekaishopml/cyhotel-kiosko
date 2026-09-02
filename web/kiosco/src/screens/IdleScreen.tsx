import { useEffect, useMemo, useRef, useState } from 'react'
import { getTypes, getKioscoConfig } from '../api'
import { BRAND } from '../constants'
import { tap } from '../lib/haptics'

interface Prices { momento: number; amanecida: number; hospedaje: number; suite: number }

const FALLBACK: Prices = { momento: 10, amanecida: 20, hospedaje: 30, suite: 20 }

const SLIDES = [
  { img: 'img/suite.jpeg' },
  { img: 'img/habitacion.jpeg' },
]

interface Props {
  onStart: () => void
  onAdmin: () => void
  version: string
}

export default function IdleScreen({ onStart, onAdmin, version }: Props) {
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const [now, setNow] = useState(() => new Date())
  const [slide, setSlide] = useState(0)
  const [kb, setKb] = useState<'a' | 'b'>('a')
  const [cycle, setCycle] = useState(0)
  const [heroChip, setHeroChip] = useState(0)
  const [prices, setPrices] = useState<Prices>(FALLBACK)
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({})
  const [transitioning, setTransitioning] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const vTaps = useRef<number[]>([])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    let active = true
    Promise.allSettled([
      getTypes('momento'),
      getTypes('amanecida'),
      getTypes('hospedaje'),
      getTypes('suite'),
      getKioscoConfig(),
    ]).then(res => {
      if (!active) return
      const [mom, am, hosp, sul, cfg] = res
      const est = (r: PromiseSettledResult<{ types: { key: string; price: number }[] }> | undefined) => {
        if (r?.status !== 'fulfilled') return undefined
        return r.value.types.find(t => t.key === 'estandar')?.price
      }
      setPrices({
        momento: est(mom) ?? FALLBACK.momento,
        amanecida: est(am) ?? FALLBACK.amanecida,
        hospedaje: est(hosp) ?? FALLBACK.hospedaje,
        suite: cfg?.status === 'fulfilled' ? cfg.value.suite_durations?.momento ?? FALLBACK.suite : FALLBACK.suite,
      })
    })
    return () => { active = false }
  }, [])

  const advance = () => {
    setTransitioning(true)
    window.setTimeout(() => {
      setSlide(s => (s + 1) % SLIDES.length)
      setKb(k => (k === 'a' ? 'b' : 'a'))
      setCycle(c => c + 1)
      setTransitioning(false)
    }, 1200)
  }

  useEffect(() => {
    const dwell = () => {
      const base = reduced ? 18 : 15
      const jitter = Math.round(((Date.now() % 21000) / 100) % 4)
      return (base + jitter) * 1000
    }
    const t = window.setTimeout(advance, dwell())
    return () => window.clearTimeout(t)
  }, [cycle, reduced])

  useEffect(() => {
    const hc = window.setInterval(() => setHeroChip(h => (h + 1) % 4), 8000)
    return () => window.clearInterval(hc)
  }, [])

  const hour = now.getHours()
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(hour)}:${pad(now.getMinutes())}`
  const greeting = hour >= 5 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const dateStr = (() => {
    const d = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })()

  const plans = useMemo<{ key: keyof Prices; label: string; from: number }[]>(() => [
    { key: 'momento', label: 'Momento', from: prices.momento },
    { key: 'amanecida', label: 'Amanecida', from: prices.amanecida },
    { key: 'hospedaje', label: 'Hospedaje', from: prices.hospedaje },
    { key: 'suite', label: 'Suite Jacuzzi', from: prices.suite },
  ], [prices])

  const start = () => {
    if (leaving) return
    tap()
    setLeaving(true)
    window.setTimeout(() => onStart(), reduced ? 80 : 450)
  }

  const adminTap = () => {
    const t = Date.now()
    vTaps.current = [...vTaps.current.filter(x => t - x < 3000), t]
    if (vTaps.current.length >= 5) {
      vTaps.current = []
      onAdmin()
    }
  }

  const cur = SLIDES[slide % SLIDES.length]
  const heroPlan = plans[heroChip]

  return (
    <div
      className={`fixed inset-0 z-[140] overflow-hidden text-[#f5f1e8] select-none ${leaving ? 'idle-leave' : 'idle-enter'}`}
      onPointerDown={start}
      style={{ background: '#0f281e' }}
    >
      {/* ===== FONDO VERDE ELEGANTE ===== */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#123526] via-[#0f281e] to-[#0a1c12]" />

      {/* ===== FOTO DE FONDO ===== */}
      {!imgFailed[slide] && (
        <div key={`bg-${slide}-${kb}`} className={`absolute inset-0 idle-bg ${transitioning ? 'idle-bg-out' : ''}`}>
          <img src={cur.img} alt="" draggable={false}
            className="absolute inset-0 w-full h-full object-cover opacity-[0.5] idle-kb-a" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f281e]/60 via-[#0f281e]/30 to-[#0a1c12]/80" />

      {/* ===== CONTENIDO CENTRADO ===== */}
      <div className="relative h-full flex flex-col items-center justify-center px-8 text-center gap-1">

        {/* Etiqueta superior */}
        <p className="idle-stagger-1 text-[#b8cbbf] text-[length:var(--fs-body)] font-bold tracking-[0.3em] uppercase idle-fade-slow">
          {greeting}
        </p>

        {/* Título grande, bold */}
        <h1 className="idle-stagger-2 font-display font-bold leading-none text-white txt-brand-xl">
          <span className="block idle-fade-slow">{BRAND.hotel}</span>
        </h1>

        {/* Regla verde + tagline */}
        <div className="idle-stagger-3 flex items-center justify-center gap-4 idle-fade-slow">
          <span className="h-px w-16 bg-[#2E7D4F]/50" />
          <span className="text-[#d0dfcf] text-[length:var(--fs-body)] font-semibold italic">{BRAND.tagline}</span>
          <span className="h-px w-16 bg-[#2E7D4F]/50" />
        </div>

        {/* Reloj grande, bold */}
        <div className="idle-stagger-4 font-display font-bold leading-none tabular-nums text-white idle-clock">
          {clock}
        </div>
        <p className="idle-stagger-5 text-[#b8cbbf] text-[length:var(--fs-small)] font-semibold capitalize tracking-wide idle-fade-slow">{dateStr}</p>

        {/* ===== PLAN PRESENTADO 1-A-1 ===== */}
        <div className="idle-stagger-6 mt-5 w-full max-w-3xl">
          <button
            key={`${heroPlan.key}-${heroChip}`}
            onPointerDown={(e) => { e.stopPropagation(); start() }}
            className="w-full idle-plan-enter group text-center outline-none"
          >
            <p className="mx-auto mb-2 h-px w-20 bg-[#2E7D4F]/40 transition-all duration-700 group-hover:w-36 group-hover:bg-[#2E7D4F]/80" />
            <span className="block idle-plan-name font-display font-bold uppercase text-white leading-none">
              {heroPlan.label}
            </span>
            <span className="inline-block mt-2 idle-plan-price font-bold text-[#d4af37]">
              desde ${heroPlan.from}
            </span>
          </button>
        </div>

        {/* ===== CTA verde ===== */}
        <button onPointerDown={(e) => { e.stopPropagation(); start() }}
          className="idle-stagger-7 idle-cta mt-6">
          <span className="cta-text block uppercase">
            tocar para comenzar
          </span>
        </button>

        {/* Línea de pie */}
        <p className="idle-stagger-8 mt-3 text-[#b8cbbf] text-[length:var(--fs-small)] font-semibold idle-fade-slow">
          Atención 24 horas
        </p>
      </div>

      {/* Pies de página discretos */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); adminTap() }}
        className="absolute bottom-2 left-4 text-[0.55rem] text-white/25 tracking-[0.6em] uppercase"
        aria-label="Acceso técnico"
      >
        · · ·
      </button>
      <span className="absolute bottom-2 right-4 text-[0.55rem] text-white/25 font-semibold">
        v{version}
      </span>
    </div>
  )
}
