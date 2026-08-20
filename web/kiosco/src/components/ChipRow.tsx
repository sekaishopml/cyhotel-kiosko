import { motion } from 'framer-motion'
import { scaleOnTap } from '../lib/animations'

interface Extra {
  key: string
  label: string
  price: number
}

interface Props {
  planKey: string
  extras: Record<string, { label: string; price: number }>
  selectedExtra: string | null
  onSelectExtra: (key: string | null) => void
  selectedDays: number
  onSelectDays: (days: number) => void
  basePrice: number
}

export default function ChipRow({
  planKey,
  extras,
  selectedExtra,
  onSelectExtra,
  selectedDays,
  onSelectDays,
  basePrice,
}: Props) {
  const isHospedaje = planKey === 'hospedaje'
  const extraEntries = Object.entries(extras).map(([key, val]) => ({ key, ...val }))

  if (isHospedaje) {
    return (
      <div className="mt-4">
        <p className="text-sm font-medium text-verde-700 mb-2">Cantidad de noches</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }, (_, i) => i + 1).map(d => (
            <motion.button
              key={d}
              {...scaleOnTap}
              onClick={() => onSelectDays(d)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                selectedDays === d
                  ? 'bg-verde-900 text-white border-verde-900'
                  : 'bg-white text-ink border-verde-900/20 hover:border-verde-600'
              }`}
            >
              {d} {d === 1 ? 'noche' : 'noches'} · ${basePrice * d}
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  if (extraEntries.length === 0) return null

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-verde-700 mb-2">Duración</p>
      <div className="flex flex-wrap gap-2">
        {extraEntries.map(ex => (
          <motion.button
            key={ex.key}
            {...scaleOnTap}
            onClick={() => onSelectExtra(selectedExtra === ex.key ? null : ex.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
              selectedExtra === ex.key
                ? 'bg-verde-900 text-white border-verde-900'
                : 'bg-white text-ink border-verde-900/20 hover:border-verde-600'
            }`}
          >
            {ex.label} · ${ex.price}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
