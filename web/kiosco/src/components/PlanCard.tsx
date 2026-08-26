import { motion } from 'framer-motion'
import { scaleOnTap } from '../lib/animations'

interface Props {
  name: string
  subtitle?: string
  badge?: string
  icon?: string
  hero?: boolean
  onClick: () => void
}

export default function PlanCard({ name, subtitle, badge, icon, hero, onClick }: Props) {
  return (
    <motion.button
      {...scaleOnTap}
      onClick={onClick}
      className={`relative w-full h-full min-h-[var(--tap)] text-left rounded-3xl p-[var(--pad)] overflow-hidden shadow-soft flex flex-col items-center justify-center text-center ${
        hero
          ? 'bg-gradient-to-br from-verde-900 to-verde-600 text-white'
          : 'bg-verde-900 text-white'
      }`}
    >
      {badge && (
        <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-verde-500 text-white text-[length:var(--fs-small)] font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">
          {badge}
        </span>
      )}
      <h3 className="font-serif text-[length:var(--fs-plan-name)] leading-tight font-extrabold">{name}</h3>
    </motion.button>
  )
}
