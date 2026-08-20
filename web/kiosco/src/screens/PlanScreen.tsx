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
      className="h-full overflow-y-auto p-6"
      {...staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif text-3xl text-verde-900 mb-6"
      >
        Elegí tu plan
      </motion.h2>
      <div className="grid gap-4">
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
