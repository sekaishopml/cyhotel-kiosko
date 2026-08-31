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
    sub: 'A/C · TV Smart · WiFi · Agua caliente',
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
  const [mood, setMood] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [heroChip, setHeroChip] = useState(0)
  const [prices, setPrices] = useState<Prices>(FALLBACK)
  const [promos, setPromos] = useState<{ title: string; subtitle: string }[]>([])
  const [promoLine, setPromoLine] = useState<string>('')
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({})
  const [transitioning, setTransitioning] = useState(false)

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
      setMood((m) => (m + 1) % 4)
      setHeroChip(h => (h + 1) % 4)
      setTransitioning(false)
    }, 650)
  }

  useEffect(() => {
    const dwell = () => {
      const base = reduced ? 15 : 10
      const jitter = Math.round(((Date.now() % 19000) / 100) % 6)
      return (base + jitter) * 1000
    }
    const t = window.setTimeout(advance, dwell())
    return () => window.clearTimeout(t)
  }, [cycle, reduced])

  useEffect(() => {
    const hc = window.setInterval(() => setHeroChip(h => (h + 1) % 4), 4200)
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

  const plans = useMemo<{ key: keyof Prices; label: string; sub: string; from: number; accent: string }[]>(() => [
    { key: 'momento', label: 'Momento', sub: '3 horas', from: prices.momento, accent: 'sky' },
    { key: 'amanecida', label: 'Amanecida', sub: '18:00 - 09:00', from: prices.amanecida, accent: 'navy' },
    { key: 'hospedaje', label: 'Hospedaje', sub: 'por noche', from: prices.hospedaje, accent: 'slate' },
    { key: 'suite', label: 'Suite Jacuzzi', sub: 'Jacuzzi', from: prices.suite, accent: 'gold' },
  ], [prices])

  const start = () => { tap(); onStart() }

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
      className="fixed inset-0 z-[140] overflow-hidden bg-[#0a0e17] text-white select-none"
      onPointerDown={start}
    >
      {/* ===== FONDO NEGRO ELEGANTE ===== */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#05070c] via-[#0a0e17] to-[#0f1526]" />

      {/* ===== IMAGEN DE FONDO SUTIL + OVERLAY ===== */}
      {!imgFailed[slide] && (
        <div key={`bg-${slide}-${kb}`} className={`absolute inset-0 idle-bg ${transitioning ? 'idle-bg-out' : ''}`}>
          <img src={cur.img} alt="" draggable={false}
            className="absolute inset-0 w-full h-full object-cover opacity-25 idle-kb-a" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05070c]/85 via-[#0a0e17]/88 to-[#0f1526]/95" />

      {/* ===== CONTENIDO CENTRADO ===== */}
      <div className="relative h-full flex flex-col items-center justify-center px-8 text-center">

        {/* Etiqueta superior */}
        <p className="text-sky-300/90 text-[length:var(--fs-small)] font-semibold tracking-[0.4em] uppercase animate-fade-up">
          {greeting} · {dateStr.split(',')[0]}
        </p>

        {/* Título grande */}
        <h1 className="mt-4 font-display font-bold leading-none tracking-tight text-white text-[length:var(--fs-display)]">
          <span className="block animate-fade-up">{BRAND.hotel}</span>
        </h1>
        <div className="mt-3 flex items-center gap-4 animate-fade-up">
          <span className="h-px w-20 bg-gradient-to-r from-transparent to-sky-400/70" />
          <span className="text-[length:var(--fs-small)] font-semibold italic text-slate-300">{BRAND.tagline}</span>
          <span className="h-px w-20 bg-gradient-to-l from-transparent to-sky-400/70" />
        </div>

        {/* Reloj grande centrado */}
        <div className="mt-6 font-display font-bold leading-none tabular-nums text-white idle-clock">
          {clock}
          <span className="ml-3 align-middle text-[length:var(--fs-section)] font-sans font-semibold text-sky-400/90">
            {hour >= 12 ? 'PM' : 'AM'}
          </span>
        </div>
        <p className="mt-1 text-slate-400 text-[length:var(--fs-small)] capitalize">{dateStr}</p>

        {/* ===== PLANES: barrido inteligente de 4 ===== */}
        <div className="mt-8 w-full max-w-5xl">
          <p className="text-[0.7rem] uppercase tracking-[0.3em] text-slate-400 font-semibold mb-3">Nuestros planes · desde ${Math.min(...plans.map(p=>p.from))}</p>
          <div className="grid grid-cols-4 gap-4">
            {plans.map((p, i) => (
              <button key={p.key}
                onPointerDown={(e) => { e.stopPropagation(); start() }}
                className={`plan-card ${heroChip === i ? `plan-card-hot plan-${p.accent}` : 'plan-card-idle'}`}>
                <span className="block text-[0.72rem] font-bold uppercase tracking-widest plan-label">{p.label}</span>
                <span className="block text-[0.8rem] text-slate-400">{p.sub}</span>
                <span className="block mt-1.5 text-[length:var(--fs-section)] font-extrabold">${p.from}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== CTA PRINCIPAL ===== */}
        <button onPointerDown={(e) => { e.stopPropagation(); start() }}
          className="idle-cta mt-9">
          <span className="relative z-10 flex items-center justify-center gap-3 text-[length:var(--fs-body)] font-extrabold">
            TOCAR PARA COMENZAR
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </button>

        {/* Línea de promociones / estado */}
        <p className="mt-4 text-slate-300/80 text-[length:var(--fs-small)]" key={promoLine || 'x'}>
          {promoLine || `Destacado: ${heroPlan?.sub ?? ''} · ${heroPlan?.label ?? ''}`}
        </p>
      </div>

      {/* Pies de página discretos */}
      <button
        onPointerDown={(e) => { e.stopPropagation(); adminTap() }}
        className="absolute bottom-2 left-4 text-[0.55rem] text-white/20 tracking-[0.6em] uppercase"
        aria-label="Acceso técnico"
      >
        · · ·
      </button>
      <span className="absolute bottom-2 right-4 text-[0.55rem] text-white/15 font-semibold">
        v{version}
      </span>
    </div>
  )
}