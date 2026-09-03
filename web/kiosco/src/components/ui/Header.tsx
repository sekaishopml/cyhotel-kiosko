import { useState, useEffect, memo } from 'react'

function Clock() {
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
    <div className="text-right">
      <p className="text-[0.9rem] font-mono font-bold text-white leading-none">{timeStr}</p>
      <p className="text-[0.55rem] text-white/50 font-semibold uppercase mt-0.5">{dateStr}</p>
    </div>
  )
}

const Header = memo(function Header() {
  return (
    <header className="bg-[var(--hc-verde-900)] text-white px-4 py-2 flex items-center justify-between shrink-0 shadow-[0_4px_20px_rgba(18,53,38,0.2)]">
      <h1 className="font-display text-[length:var(--fs-body)] font-bold tracking-wide">
        Hotel Del Valle
      </h1>
      <Clock />
    </header>
  )
})

export default Header
