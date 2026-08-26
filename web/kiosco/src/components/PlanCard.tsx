import { motion } from 'framer-motion'
import { scaleOnTap } from '../lib/animations'

interface Props {
  name: string
  subtitle: string
  badge?: string
  icon: string
  hero?: boolean
  onClick: () => void
}

export default function PlanCard({ name, subtitle, badge, icon, hero, onClick }: Props) {
  return (
    <motion.button
      {...scaleOnTap}
      onClick={onClick}
      className={`relative w-full h-full min-h-[var(--tap)] text-left rounded-3xl p-[var(--pad)] overflow-hidden shadow-soft flex items-center ${
        hero
          ? 'bg-gradient-to-br from-verde-900 to-verde-600 text-white'
          : 'bg-verde-900 text-white'
      }`}
    >
      {badge && (
        <span className="absolute top-4 right-4 bg-verde-500 text-white text-[length:var(--fs-small)] font-extrabold px-3 py-1 rounded-full uppercase tracking-wide">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-5 w-full">
        <div className="w-[var(--icon)] h-[var(--icon)] rounded-2xl bg-white/15 flex items-center justify-center text-[length:calc(var(--icon)*0.55)] shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-[length:var(--fs-plan-name)] leading-tight font-extrabold">{name}</h3>
          <p className="text-[length:var(--fs-plan-sub)] opacity-85 mt-1 leading-snug">{subtitle}</p>
        </div>
      </div>
    </motion.button>
  )
}
