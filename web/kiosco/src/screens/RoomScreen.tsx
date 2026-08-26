import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { getTypes } from '../api'
import { RoomType } from '../types'
import RoomCard from '../components/RoomCard'

export default function RoomScreen() {
  const { selectedPlan, selectedRoom, selectedExtra, selectedDays, selectRoom, selectExtra, selectDays, goBack, goTo } = useStore()
  const [rooms, setRooms] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTypes(selectedPlan!)
      .then(data => { if (!cancelled) setRooms(data.types) })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar las habitaciones.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedPlan])

  const currentRoom = rooms.find(r => r.key === selectedRoom)
  const basePrice = currentRoom?.price ?? 0
  const extraPrice = selectedExtra && currentRoom?.extras[selectedExtra]
    ? currentRoom.extras[selectedExtra].price
    : 0
  const total = selectedPlan === 'hospedaje'
    ? basePrice * selectedDays
    : basePrice + extraPrice

  const planLabels: Record<string, string> = {
    momento: 'MOMENTO',
    amanecida: 'AMANECIDA',
    hospedaje: 'HOSPEDAJE',
    suite: 'SUITE JACUZZI',
  }

  return (
    <div className="h-full flex flex-col screen-enter">
      <div className="shrink-0 px-[var(--pad)] py-[var(--gap)] flex items-center gap-3">
        <button onClick={goBack} className="tap-scale w-10 h-10 rounded-full bg-navy/8 flex items-center justify-center text-navy hover:bg-navy/15 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-[length:var(--fs-section)] text-navy font-bold uppercase">
          {planLabels[selectedPlan!] ?? selectedPlan}
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-[var(--pad)] pb-[var(--gap)]">
        {loading && (
          <div className="grid grid-cols-2 gap-[var(--gap)]">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[var(--room-h)] rounded-2xl bg-white/50 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 font-semibold mb-3">{error}</p>
            <button onClick={() => window.location.reload()} className="text-gold underline font-semibold">
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 gap-[var(--gap)]">
            {rooms.map((room, i) => (
              <div key={room.key} className={`opacity-0 animate-fade-up stagger-${Math.min(i + 1, 4)}`}>
                <RoomCard
                  room={room}
                  selected={selectedRoom === room.key}
                  onClick={() => selectRoom(room.key)}
                />
              </div>
            ))}
          </div>
        )}

        {currentRoom && currentRoom.extras && Object.keys(currentRoom.extras).length > 0 && (
          <div className="mt-4">
            <p className="text-[length:var(--fs-small)] font-semibold text-slate mb-2 uppercase">Duración</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(currentRoom.extras).map(([key, val]: [string, { label: string; price: number }]) => (
                <button
                  key={key}
                  onClick={() => selectExtra(selectedExtra === key ? null : key)}
                  className={`tap-scale px-4 py-2 rounded-full text-[length:var(--fs-small)] font-bold border-2 transition-all uppercase ${
                    selectedExtra === key
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-navy border-navy/15 hover:border-gold/40'
                  }`}
                >
                  {val.label} · ${val.price}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPlan === 'hospedaje' && (
          <div className="mt-4">
            <p className="text-[length:var(--fs-small)] font-semibold text-slate mb-2 uppercase">Noches</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 7 }, (_, i) => i + 1).map(d => (
                <button
                  key={d}
                  onClick={() => selectDays(d)}
                  className={`tap-scale px-4 py-2 rounded-full text-[length:var(--fs-small)] font-bold border-2 transition-all ${
                    selectedDays === d
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-navy border-navy/15 hover:border-gold/40'
                  }`}
                >
                  {d} {d === 1 ? 'noche' : 'noches'} · ${basePrice * d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedRoom && (
        <div className="shrink-0 bg-white border-t border-navy/8 px-[var(--pad)] py-[var(--gap)] flex items-center gap-4 animate-slide-up">
          <div className="flex-1">
            <p className="text-[length:var(--fs-small)] text-slate uppercase tracking-wide font-semibold">Total</p>
            <p className="font-display text-[length:var(--fs-section)] text-navy font-bold">${total}</p>
          </div>
          <button
            onClick={() => goTo('checkin')}
            className="tap-scale bg-navy text-white rounded-2xl px-8 py-[var(--gap)] font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  )
}
