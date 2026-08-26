import { useStore } from '../store'
import PlanCard from '../components/PlanCard'
import { Plan } from '../types'

const plans: Plan[] = [
  { key: 'momento', name: 'Momento', badge: 'El más pedido', hero: true },
  { key: 'amanecida', name: 'Amanecida', hero: false },
  { key: 'hospedaje', name: 'Hospedaje', hero: false },
  { key: 'suite', name: 'Suite Jacuzzi', hero: false },
]

export default function PlanScreen() {
  const { selectPlan } = useStore()

  return (
    <div className="h-full overflow-hidden p-[var(--pad)] flex flex-col">
      <h2 className="font-display text-[length:var(--fs-display)] text-navy font-bold uppercase tracking-wide text-center mb-[var(--gap)]">
        Elegí Tu Plan
      </h2>

      <div className="flex flex-col gap-[var(--gap)] flex-1 min-h-0">
        {plans.map((plan, i) => (
          <div
            key={plan.key}
            className={`flex-1 min-h-0 opacity-0 animate-fade-up stagger-${i + 1}`}
          >
            <PlanCard plan={plan} onClick={() => selectPlan(plan.key)} />
          </div>
        ))}
      </div>
    </div>
  )
}
