import { useEffect, useMemo, useRef, useState } from 'react'
import { getTypes, getKioscoConfig } from '../api'
import { BRAND } from '../constants'
import { tap } from '../lib/haptics'

interface Prices { momento: number; amanecida: number; hospedaje: number; suite: number }

const FALLBACK: Prices = { momento: 10, amanecida: 20, hospedaje: 30, suite: 20 }

const SLIDES = [
  {
    img: 'img/suite.jpeg',
    title: 'Suite Jacuzzi',
    sub: 'Jacuzzi con hidromasaje · Volcán · TV Smart',
    taste: 'La favorita para consentirse',
  },
  {
    img: 'img/habitacion.jpeg',
    title: 'Habitación Sencilla',
    sub: 'A/C · TV Smart · WiFi · agua caliente',
    taste: 'Confort y comodidad a un clic',
  },
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
  const [promos, setPromos] = useState<{ title: string; subtitle: string }[]>([])
  const [promoLine, setPromoLine] = useState<string>('')
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
      setPromos(cfg?.status === 'fulfilled' ? cfg.value.promos ?? [] : [])
    })
    return () => { active = false }
  }, [])

  const advance = () => {
    setTransitioning(true)
    window.setTimeout(() => {
      setSlide(s => (s + 1) % SLIDES.length)
      setKb(k => (k === 'a' ? 'b' : 'a'))
      setCycle(c => c + 1)
      setHeroChip(h => (h + 1) % 4)
      setTransitioning(false)
    }, 700)
  }

  useEffect(() => {
    const dwell = () => {
      const base = reduced ? 15 : 11
      const jitter = Math.round(((Date.now() % 19000) / 100) % 5)
      return (base + jitter) * 1000
    }
    const t = window.setTimeout(advance, dwell())
    return () => window.clearTimeout(t)
  }, [cycle, reduced])

  useEffect(() => {
    const hc = window.setInterval(() => setHeroChip(h => (h + 1) % 4), 4600)
    return () => window.clearInterval(hc)
  }, [])

  useEffect(() => {
    if (!promos.length) { setPromoLine(''); return }
    const id = window.setInterval(() => {
      setPromoLine(prev => {
        const i = (promos.findIndex(p => `${p.title} · ${p.subtitle}` === prev) + 1 + promos.length) % promos.length
        const p = promos[i]
        return `${p.title} · ${p.subtitle}`
      })
    }, 9400)
    return () => window.clearInterval(id)
  }, [promos.length])

  const hour = now.getHours()
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(hour)}:${pad(now.getMinutes())}`
  const greeting = hour >= 5 && hour < 12 ? 'Buenos días' : hour >= 12 && hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const dateStr = (() => {
    const d = now.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
    return d.charAt(0).toUpperCase() + d.slice(1)
  })()

  const plans = useMemo<{ key: keyof Prices; label: string; sub: string; from: number }[]>(() => [
    { key: 'momento', label: 'Momento', sub: '3 horas', from: prices.momento },
    { key: 'amanecida', label: 'Amanecida', sub: '18:00 – 09:00', from: prices.amanecida },
    { key: 'hospedaje', label: 'Hospedaje', sub: 'por noche', from: prices.hospedaje },
    { key: 'suite', label: 'Suite Jacuzzi', sub: 'con jacuzzi', from: prices.suite },
  ], [prices])

  const start = () => {
    if (leaving) return
    tap()
    setLeaving(true)
    window.setTimeout(() => onStart(), reduced ? 80 : 380)
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
      className={`fixed inset-0 z-[140] overflow-hidden bg-cream text-[#0e1a2b] select-none ${leaving ? 'idle-leave' : 'idle-enter'}`}
      onPointerDown={start}
    >
      {/* ===== FONDO CLARO, AIRE, EDITORIAL ===== */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#fdfcf9] via-cream to-[#f4f1ea]" />

      {/* ===== FOTO DE FONDO ===== */}
      {!imgFailed[slide] && (
        <div key={`bg-${slide}-${kb}`} className={`absolute inset-0 idle-bg ${transitioning ? 'idle-bg-out' : ''}`}>
          <img src={cur.img} alt="" draggable={false}
            className="absolute inset-0 w-full h-full object-cover opacity-[0.5] idle-kb-a" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-[#fdfcf9]/45 via-[#fdfcf9]/15 to-[#f4f1ea]/60" />

      {/* ===== CONTENIDO CENTRADO ===== */}
      <div className="relative h-full flex flex-col items-center justify-center px-10 text-center">

        {/* Etiqueta superior */}
        <p className="text-[#2c3e50] text-[length:var(--fs-body)] font-bold tracking-[0.3em] uppercase animate-fade-up">
          {greeting}
        </p>

        {/* Título grande, bold */}
        <h1 className="mt-3 font-display font-bold leading-none text-[#0e1a2b] txt-brand-xl">
          <span className="block animate-fade-up">{BRAND.hotel}</span>
        </h1>

        {/* Regla + tagline */}
        <div className="mt-4 flex items-center justify-center gap-4 animate-fade-up">
          <span className="h-px w-16 bg-[#0e1a2b]/25" />
          <span className="text-[#2c3e50] text-[length:var(--fs-body)] font-semibold italic">{BRAND.tagline}</span>
          <span className="h-px w-16 bg-[#0e1a2b]/25" />
        </div>

        {/* Reloj grande, bold */}
        <div className="mt-7 font-display font-bold leading-none tabular-nums text-[#0e1a2b] idle-clock">
          {clock}
        </div>
        <p className="mt-3 text-[#2c3e50] text-[length:var(--fs-body)] font-semibold capitalize tracking-wide">{dateStr}</p>

        {/* ===== PLANES ===== */}
        <div className="mt-7 w-full max-w-5xl">
          <div className="grid grid-cols-4 gap-px bg-[#0e1a2b]/15 overflow-hidden rounded-lg">
            {plans.map((p, i) => (
              <button key={p.key}
                onPointerDown={(e) => { e.stopPropagation(); start() }}
                className={`plan-card ${heroChip === i ? 'plan-card-hot' : ''}`}>
                <span className="block text-[1.05rem] uppercase tracking-[0.16em] font-bold plan-label">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== CTA con fondo oscuro ===== */}
        <button onPointerDown={(e) => { e.stopPropagation(); start() }}
          className="idle-cta mt-10">
          <span className="block text-[length:var(--fs-section)] font-bold tracking-[0.16em] uppercase">
            tocar para comenzar
          </span>
        </button>

        {/* Línea de pie */}
        <p className="mt-5 text-[#33475c] text-[length:var(--fs-body)] font-semibold" key={promoLine || 'x'}>
          {promoLine || `${cur.taste} · atención 24 horas`}
        </p>
      </div>

      {/* Pies de página discretos */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); adminTap() }}
        className="absolute bottom-2 left-4 text-[0.55rem] text-[#0e1a2b]/25 tracking-[0.6em] uppercase"
        aria-label="Acceso técnico"
      >
        · · ·
      </button>
      <span className="absolute bottom-2 right-4 text-[0.55rem] text-[#0e1a2b]/20 font-semibold">
        v{version}
      </span>
    </div>
  )
}