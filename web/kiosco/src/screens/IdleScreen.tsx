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
    sub: 'Jacuzzi con hidromasaje · volcán · TV Smart',
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
  const [mood, setMood] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [heroChip, setHeroChip] = useState(0)
  const [prices, setPrices] = useState<Prices>(FALLBACK)
  const [promos, setPromos] = useState<{ title: string; subtitle: string }[]>([])
  const [promoLine, setPromoLine] = useState<string>('')
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({})

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

  useEffect(() => {
    const advance = () => {
      setSlide(s => (s + 1) % SLIDES.length)
      setKb(k => (k === 'a' ? 'b' : 'a'))
      setCycle(c => c + 1)
      setMood(c => (c + 1) % 4)
      setHeroChip(h => (h + 1) % 4)
    }
    const dwell = () => {
      const base = reduced ? 13 : 8.5
      const jitter = Math.round(((Date.now() % 17000) / 100) % 6)
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

  const plans = useMemo<{ key: keyof Prices; label: string; sub: string; from: number }[]>(() => [
    { key: 'momento', label: 'Momento', sub: '3 horas', from: prices.momento },
    { key: 'amanecida', label: 'Amanecida', sub: '18:00 - 09:00', from: prices.amanecida },
    { key: 'hospedaje', label: 'Hospedaje', sub: 'por noche', from: prices.hospedaje },
    { key: 'suite', label: 'Suite Jacuzzi', sub: 'Jacuzzi', from: prices.suite },
  ], [prices])

  const particles = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        id: i,
        x: 6 + ((i * 37) % 88),
        y: 8 + ((i * 53) % 80),
        dur: 26 + ((i * 7) % 22),
        del: (i * 3.1) % 12,
        s: 3 + (i % 3),
      })),
    [],
  )

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

  return (
    <div
      className="fixed inset-0 z-[140] overflow-hidden bg-[#0b1120] text-white select-none"
      onPointerDown={start}
    >
      {/* ===== FONDO DE MARCA ===== */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy via-[#101b33] to-[#0b1120]" />

      {!reduced && particles.map(p => (
        <span
          key={p.id}
          className="idle-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            animationDuration: `${p.dur}s`,
            animationDelay: `-${p.del}s`,
          }}
        />
      ))}

      {mood === 3 ? (
        /* ===== ESCENA INMERSIVA: foto a sangre + mensaje ===== */
        <div className="absolute inset-0">
          {!imgFailed[slide] && (
            <img key={`bg-${slide}-${kb}`} src={cur.img} alt="" draggable={false}
              className={`absolute inset-0 w-full h-full object-cover idle-kb-${kb}`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-[#0b1120]/72 to-navy/30" />

          <div className="relative h-full flex flex-col items-center justify-center px-10 text-center">
            <p className="text-gold/90 text-[length:var(--fs-small)] font-semibold tracking-[0.35em] uppercase animate-fade-up">
              {greeting} · {dateStr.split(',')[0]}
            </p>
            <h1 className={`mt-3 font-display font-bold leading-tight ${reduced ? 'text-[3rem]' : 'text-[3.4rem]'}`}>
              <span className="block animate-fade-up">{BRAND.hotel}</span>
            </h1>
            <div className="mt-3 flex items-center gap-3 text-gold/80">
              <span className="h-px w-16 gold-line" />
              <span className="text-[length:var(--fs-small)] font-semibold italic">{BRAND.tagline}</span>
              <span className="h-px w-16 gold-line" />
            </div>

            <div className="mt-8 grid grid-cols-4 gap-3 w-full max-w-4xl">
              {plans.map((p, i) => (
                <div key={p.key} className={`grace-card ${heroChip === i ? 'grace-card-hot' : ''}`}>
                  <div className="text-[0.6rem] font-bold uppercase tracking-widest text-gold/80">{p.label}</div>
                  <div className="text-[0.7rem] text-white/60">{p.sub}</div>
                  <div className="mt-1 text-[length:var(--fs-body)] font-extrabold text-white">${p.from}</div>
                </div>
              ))}
            </div>

            <button onPointerDown={(e) => { e.stopPropagation(); start() }}
              className="idle-cta mt-8">
              <span className="relative z-10 flex items-center justify-center gap-3 text-[length:var(--fs-small)] font-extrabold">
                TOCAR PARA COMENZAR
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </button>
          </div>

          <div className="absolute left-6 bottom-8 flex items-center gap-4">
            <span className="text-[0.75rem] text-white/60 max-w-xs leading-snug" key={promoLine}>
              {promoLine || `${cur.taste} · pago en efectivo en recepción`}
            </span>
          </div>
        </div>
      ) : (
        /* ===== ESCENA EDITORIAL: galería + panel info ===== */
        <div className="relative h-full flex items-center gap-6 px-7 py-8">
          {/* Galería */}
          <div className="flex-1 h-full min-w-0 flex items-stretch gap-4">
            <div className="relative flex-1 min-w-0 rounded-2xl overflow-hidden gold-frame">
              {!imgFailed[slide] && (
                <img key={`main-${slide}-${kb}`} src={cur.img} alt={cur.title} draggable={false}
                  className={`absolute inset-0 w-full h-full object-cover idle-kb-${kb} ${mood === 1 ? 'idle-zoom-in' : ''}`} />
              )}
              {!imgFailed[slide] && <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />}
              <div className="absolute left-4 bottom-3 right-4">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-gold/90">{cur.title}</p>
                <p className="text-[0.85rem] text-white/85 font-medium">{cur.sub}</p>
              </div>
              {mood === 1 && (
                <div className="absolute top-4 right-4 bg-navy/90 px-4 py-2 rounded-full border border-gold/40 price-flash">
                  <span className="text-[0.7rem] uppercase tracking-widest text-gold/80 font-bold">Desde</span>
                  <span className="ml-2 text-[length:var(--fs-body)] font-extrabold text-white">
                    ${prices[plans[heroChip]?.key ?? 'momento'] ?? prices.momento}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-2.5 w-20">
              {SLIDES.map((s, i) => (
                <button key={s.title} aria-label={`Ver ${s.title}`}
                  onPointerDown={(e) => { e.stopPropagation(); tap(); setSlide(i) }}
                  className={`relative h-14 rounded-lg overflow-hidden border transition-all duration-500 ${i === slide ? 'border-gold ring-2 ring-gold/30' : 'border-white/15 opacity-70 hover:opacity-100'}`}>
                  <img src={s.img} alt="" draggable={false} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Panel de información */}
          <div className="w-[42%] min-w-[380px] h-full flex flex-col justify-center">
            <p className="text-gold/90 text-[length:var(--fs-small)] font-semibold tracking-[0.3em] uppercase animate-fade-up">
              {greeting}
            </p>
            <p className="mt-0.5 text-white/60 text-[length:var(--fs-small)] capitalize">{dateStr}</p>

            <div className="mt-4 font-display font-bold leading-none tabular-nums text-white idle-clock">
              {clock}
              <span className="ml-3 align-middle text-[length:var(--fs-small)] font-sans font-semibold text-gold/80">
                {hour >= 12 ? 'PM' : 'AM'}
              </span>
            </div>

            <h1 className="mt-5 font-display font-bold leading-tight text-[length:var(--fs-display)]">
              <span className="text-white">{BRAND.hotel}</span>
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="h-px w-10 gold-line" />
              <span className="text-[length:var(--fs-small)] text-gold/80 font-semibold italic">{BRAND.tagline}</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {plans.map((p, i) => (
                <button key={p.key} onPointerDown={(e) => { e.stopPropagation(); start() }}
                  className={`grace-card text-left ${heroChip === i ? 'grace-card-hot' : ''}`}>
                  <span className="block text-[0.62rem] font-bold uppercase tracking-widest text-gold/80">{p.label}</span>
                  <span className="block text-[0.65rem] text-white/55">{p.sub}</span>
                  <span className="block mt-0.5 text-[length:var(--fs-body)] font-extrabold text-white">Desde ${p.from}</span>
                </button>
              ))}
            </div>

            <button onPointerDown={(e) => { e.stopPropagation(); start() }}
              className="idle-cta mt-7">
              <span className="relative z-10 flex items-center justify-center gap-3 text-[length:var(--fs-body)] font-extrabold">
                TOCAR PARA COMENZAR
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </span>
            </button>

            <p className="mt-4 text-white/55 text-[length:var(--fs-small)]" key={promoLine || 'x'}>
              {promoLine
                ? promoLine
                : mood === 1 ? `Destacado: ${plans[heroChip]?.sub ?? ''} por ${plans[heroChip]?.label ?? ''}` : 'Pago en efectivo · Atención 24 horas'}
            </p>
          </div>
        </div>
      )}

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