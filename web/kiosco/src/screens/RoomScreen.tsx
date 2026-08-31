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
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
  const [showMoreNights, setShowMoreNights] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTypes(selectedPlan!)
      .then(data => {
        if (!cancelled) {
          setRooms(data.types)
          if (selectedPlan === 'suite') {
            const suiteRoom = data.types.find((r: RoomType) => r.key === 'suite')
            if (suiteRoom && !selectedRoom) {
              selectRoom('suite')
              setExpandedRoom('suite')
              selectExtra('momento')
            }
          }
        }
      })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar las habitaciones.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedPlan, retryCount])

  const handleRoomClick = (roomKey: string) => {
    if (expandedRoom === roomKey) {
      setExpandedRoom(null)
    } else {
      setExpandedRoom(roomKey)
      selectRoom(roomKey)
    }
  }

  const currentRoom = rooms.find(r => r.key === selectedRoom)
  const basePrice = currentRoom?.price ?? 0
  const extraPrice = selectedExtra && currentRoom?.extras?.[selectedExtra]
    ? currentRoom.extras[selectedExtra].price
    : 0
  const total = selectedPlan === 'hospedaje'
    ? basePrice * selectedDays
    : selectedPlan === 'suite' && selectedExtra
    ? extraPrice
    : basePrice + extraPrice

  const planLabels: Record<string, string> = {
    momento: 'MOMENTO',
    amanecida: 'AMANECIDA',
    hospedaje: 'HOSPEDAJE',
    suite: 'SUITE JACUZZI',
  }

  const extras = selectedPlan === 'hospedaje' ? {} : (currentRoom?.extras ?? {})
  const hasExtras = Object.keys(extras).length > 0
  const isSuite = selectedPlan === 'suite'

  return (
    <div className="h-full flex flex-col slide-in-right">
      <div className="shrink-0 px-4 pb-2 pt-1">
        <div className="h-[3px] bg-navy/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold to-amber-500 rounded-full progress-fill" style={{ width: '66%' }} />
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 flex items-center gap-3">
        <button onClick={goBack} className="tap-scale w-12 h-12 rounded-full bg-navy/8 flex items-center justify-center text-navy hover:bg-navy/15 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-[length:var(--fs-body)] text-navy font-bold uppercase">
          {planLabels[selectedPlan!] ?? selectedPlan}
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-4">
        {loading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton w-full p-3" style={{ height: '76px', animationDelay: `${i * 0.15}s` }}>
                <div className="flex items-center gap-3 h-full">
                  <div className="skeleton-thumb shrink-0" />
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <div className="skeleton-text" />
                    <div className="skeleton-text-short" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-navy/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-navy/60 font-semibold mb-3">{error}</p>
            <button onClick={() => setRetryCount(c => c + 1)} className="text-gold font-bold underline">Reintentar</button>
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-navy/5 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <p className="text-navy/60 font-semibold">No hay habitaciones disponibles</p>
          </div>
        )}

        {!loading && !error && rooms.length > 0 && (
          <div className="flex flex-col gap-2">
            {rooms.map((room, i) => (
              <div
                key={room.key}
                className="opacity-0 animate-fade-up"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <RoomCard
                  room={room}
                  selected={selectedRoom === room.key}
                  selectedPlan={selectedPlan!}
                  expanded={expandedRoom === room.key}
                  onClick={() => handleRoomClick(room.key)}
                  selectedExtra={selectedRoom === room.key ? selectedExtra : null}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRoom && (
        <div className={`shrink-0 border-t px-4 py-3 bottom-bar ${
          isSuite ? 'bg-navy border-navy/30' : 'bg-gold/10 border-gold/20'
        }`}>
          {hasExtras && isSuite && (
            <div className="mb-3">
              <p className="text-[0.7rem] font-semibold text-white/50 mb-2 uppercase tracking-wide">Duración</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(extras).map(([key, val]: [string, { label: string; price: number }]) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (selectedExtra === key && isSuite) return
                      selectExtra(selectedExtra === key ? null : key)
                    }}
                    className={`tap-scale w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200 ${
                      selectedExtra === key
                        ? 'bg-white/10 text-white border-white/20 shadow-md'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="font-bold text-[0.85rem] uppercase">{val.label}</span>
                    <span className={`font-extrabold text-lg ${selectedExtra === key ? 'text-gold' : 'text-white/80'}`}>${val.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasExtras && !isSuite && (
            <div className="mb-3">
              <p className="text-[0.7rem] font-semibold text-navy mb-2 uppercase tracking-wide">Duración</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {Object.entries(extras).map(([key, val]: [string, { label: string; price: number }]) => (
                  <button
                    key={key}
                    onClick={() => selectExtra(selectedExtra === key ? null : key)}
                    className={`tap-scale shrink-0 px-5 py-2.5 rounded-lg text-[0.8rem] font-bold border transition-all duration-200 uppercase ${
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
            <div className="mb-3">
              <p className="text-[0.7rem] font-semibold text-navy mb-2 uppercase tracking-wide">Noches</p>
              <div className={`grid ${showMoreNights ? 'grid-cols-8' : 'grid-cols-4'} gap-1.5`}>
                {Array.from({ length: showMoreNights ? 15 : 7 }, (_, i) => i + 1).map(d => (
                  <button
                    key={d}
                    onClick={() => selectDays(d)}
                    className={`tap-scale w-full flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[0.8rem] font-bold border transition-all duration-200 uppercase ${
                      selectedDays === d
                        ? 'bg-navy text-white border-navy shadow-md'
                        : 'bg-white text-navy border-navy/15 hover:border-gold/40'
                    }`}
                  >
                    <span>{d}</span>
                    <span className={selectedDays === d ? 'text-gold' : 'text-navy/50'}>${basePrice * d}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowMoreNights(s => !s)}
                className="tap-scale mt-1.5 w-full py-2 rounded-lg text-[0.8rem] font-bold border border-navy/15 bg-white text-navy hover:border-gold/40 transition-colors uppercase"
              >
                {showMoreNights ? 'Menos' : 'Más.'}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className={`text-[0.7rem] uppercase tracking-wide font-semibold ${isSuite ? 'text-white/40' : 'text-navy/60'}`}>Total</p>
              <p className={`font-display text-3xl font-bold leading-none ${isSuite ? 'text-gold' : 'text-navy'}`}>${total}</p>
            </div>
            <button
              onClick={() => goTo('checkin')}
              className={`tap-scale text-white rounded-lg px-8 py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide transition-colors shadow-lg ${
                isSuite
                  ? 'bg-gold hover:bg-gold/90 shadow-gold/25'
                  : 'bg-navy hover:bg-navy/90 shadow-navy/25'
              }`}
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
