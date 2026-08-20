import { motion } from 'framer-motion'
import { fadeInUp, scaleOnTap } from '../lib/animations'

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
      {...fadeInUp}
      {...scaleOnTap}
      onClick={onClick}
      className={`relative w-full text-left rounded-3xl p-6 overflow-hidden ${
        hero
          ? 'bg-gradient-to-br from-verde-900 to-verde-600 text-white'
          : 'bg-ink text-white'
      }`}
    >
      {badge && (
        <span className="absolute top-4 right-4 bg-verde-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-4">
        <div className="w-[72px] h-[72px] rounded-full bg-white/15 flex items-center justify-center text-3xl shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-[38px] leading-tight font-semibold truncate">{name}</h3>
          <p className="text-[20px] opacity-80 mt-1 truncate">{subtitle}</p>
        </div>
      </div>
    </motion.button>
  )
}
