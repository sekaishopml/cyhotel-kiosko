import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, screenRight, staggerContainer, slideUpBar } from '../lib/animations'
import { getTypes, type TypeOption } from '../api/client'
import RoomCard from '../components/RoomCard'
import ChipRow from '../components/ChipRow'
import LoadingShimmer from '../components/LoadingShimmer'

interface Props {
  planKey: string
  selectedRoom: string | null
  selectedExtra: string | null
  selectedDays: number
  onSelectRoom: (roomKey: string) => void
  onSelectExtra: (extra: string | null) => void
  onSelectDays: (days: number) => void
  onBack: () => void
  onContinue: () => void
}

const planLabels: Record<string, string> = {
  momento: 'Momento',
  amanecida: 'Amanecida',
  hospedaje: 'Hospedaje',
  suite_jacuzzi: 'Suite Jacuzzi',
}

export default function RoomScreen({
  planKey,
  selectedRoom,
  selectedExtra,
  selectedDays,
  onSelectRoom,
  onSelectExtra,
  onSelectDays,
  onBack,
  onContinue,
}: Props) {
  const [rooms, setRooms] = useState<TypeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTypes(planKey)
      .then(data => {
        if (!cancelled) setRooms(data.types)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar las habitaciones.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [planKey])

  const currentRoom = rooms.find(r => r.key === selectedRoom)
  const basePrice = currentRoom?.price ?? 0
  const extraPrice = selectedExtra && currentRoom?.extras[selectedExtra]
    ? currentRoom.extras[selectedExtra].price
    : 0
  const total = planKey === 'hospedaje'
    ? basePrice * selectedDays
    : basePrice + extraPrice

  return (
    <motion.div className="h-full flex flex-col" {...screenRight}>
      <div className="shrink-0 px-[var(--pad)] pt-[var(--gap)] pb-[var(--gap)] flex items-center gap-3">
        <button onClick={onBack} className="text-verde-600 hover:text-verde-900 transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-serif text-[length:var(--fs-section)] text-verde-900 font-semibold">
          {planLabels[planKey] ?? planKey}
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-[var(--pad)] pb-[var(--gap)]">
        {loading && <LoadingShimmer />}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-verde-600 underline text-[length:var(--fs-small)]"
            >
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-3 gap-[var(--gap)]"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {rooms.map(room => (
              <RoomCard
                key={room.key}
                name={room.label}
                photo={room.photo}
                price={room.price}
                free={room.free}
                selected={selectedRoom === room.key}
                onClick={() => onSelectRoom(room.key)}
              />
            ))}
          </motion.div>
        )}

        {currentRoom && (
          <ChipRow
            planKey={planKey}
            extras={currentRoom.extras}
            selectedExtra={selectedExtra}
            onSelectExtra={onSelectExtra}
            selectedDays={selectedDays}
            onSelectDays={onSelectDays}
            basePrice={basePrice}
          />
        )}
      </div>

        {selectedRoom && (
          <motion.div
            {...slideUpBar}
            className="shrink-0 bg-white border-t border-verde-900/10 px-[var(--pad)] py-[var(--gap)] flex items-center gap-4"
          >
          <div className="flex-1">
            <p className="text-[length:var(--fs-small)] text-verde-700/60 uppercase tracking-wide">Total</p>
            <p className="font-serif text-[length:var(--fs-section)] text-verde-900 font-bold">${total}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onContinue}
            className="bg-verde-900 text-white rounded-2xl px-8 py-[var(--gap)] font-semibold text-[length:var(--fs-body)] hover:bg-verde-700 transition-colors"
          >
            Continuar
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  )
}
