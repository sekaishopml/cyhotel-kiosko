import { motion } from 'framer-motion'
import { staggerContainer } from '../lib/animations'
import PlanCard from '../components/PlanCard'

interface Props {
  onSelect: (planKey: string) => void
}

const plans = [
  { key: 'momento', name: 'Momento', subtitle: 'Por horas, sin complicaciones', icon: '⏱', badge: 'El más pedido', hero: true },
  { key: 'amanecida', name: 'Amanecida', subtitle: 'Desde la tarde hasta la mañana', icon: '🌅', hero: false },
  { key: 'hospedaje', name: 'Hospedaje', subtitle: 'Estadía por noches', icon: '🌙', hero: false },
  { key: 'suite_jacuzzi', name: 'Suite Jacuzzi', subtitle: 'Lujo y relax con jacuzzi', icon: '🛁', hero: false },
]

export default function PlanScreen({ onSelect }: Props) {
  return (
    <motion.div
      className="h-full overflow-hidden p-[var(--pad)] flex flex-col"
      {...staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif text-[length:var(--fs-display)] text-verde-900 mb-[var(--gap)]"
      >
        Elegí tu plan
      </motion.h2>
      <div className="grid grid-cols-2 grid-rows-2 gap-[var(--gap)] flex-1 min-h-0">
        {plans.map(plan => (
          <PlanCard
            key={plan.key}
            name={plan.name}
            subtitle={plan.subtitle}
            icon={plan.icon}
            badge={plan.badge}
            hero={plan.hero}
            onClick={() => onSelect(plan.key)}
          />
        ))}
      </div>
    </motion.div>
  )
}
