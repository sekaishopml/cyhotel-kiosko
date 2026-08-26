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

export default function PlanCard({ name, badge, hero, onClick }: Props) {
  return (
    <motion.button
      {...scaleOnTap}
      initial={{ scale: 0.97 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onClick={onClick}
      className={`relative w-full h-full min-h-[var(--tap)] rounded-3xl p-[var(--pad)] overflow-hidden flex flex-col items-center justify-center text-center border-2 transition-colors ${
        hero
          ? 'bg-verde-900 text-white border-verde-900'
          : 'bg-white text-verde-900 border-verde-900/12 border-l-4 border-l-verde-500'
      }`}
    >
      {hero && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#F3ECDD]" />
      )}
      {badge && (
        <span className={`absolute top-3 right-3 text-[length:var(--fs-small)] font-bold uppercase tracking-[0.15em] ${hero ? 'text-verde-200' : 'text-verde-600'}`}>
          {badge}
        </span>
      )}
      <h3 className="font-sans text-[length:var(--fs-plan-name)] leading-[1.05] font-extrabold uppercase tracking-wide">{name}</h3>
    </motion.button>
  )
}
