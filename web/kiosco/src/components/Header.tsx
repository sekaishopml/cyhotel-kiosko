import { useState, useEffect } from 'react'

export default function Header() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Guayaquil',
  })

  const dateStr = now.toLocaleDateString('es-EC', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Guayaquil',
  })

  return (
    <header className="bg-gradient-to-b from-navy to-[#1a2744] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-[0_4px_20px_rgba(15,23,42,0.2)]">
      <div>
        <h1 className="font-display text-[length:var(--fs-body)] font-bold tracking-wide leading-tight">
          Hotel Del Valle
        </h1>
        <span className="text-[0.55rem] text-white/40 font-semibold">v1.0.7</span>
      </div>
      <div className="text-right">
        <p className="text-[0.95rem] font-mono font-bold text-gold leading-none">{timeStr}</p>
        <p className="text-[0.6rem] text-white/50 font-semibold uppercase mt-0.5">{dateStr}</p>
      </div>
    </header>
  )
}
