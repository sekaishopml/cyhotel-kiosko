import { useRef } from 'react'
import { useStore } from '../store'
import PlanCard from '../components/PlanCard'
import { PLANS } from '../constants'

export default function PlanScreen() {
  const { selectPlan } = useStore()
  const armedAt = useRef(Date.now())

  const pick = (key: string) => {
    if (Date.now() - armedAt.current < 500) return
    selectPlan(key)
  }

  return (
    <div className="h-full overflow-hidden px-4 pt-3 pb-2 flex flex-col">
      <h2 className="plan-enter-title font-display text-[length:var(--fs-body)] text-navy font-bold uppercase tracking-wide text-center mb-2">
        Elegí Tu Plan
      </h2>

      <div className="flex flex-col gap-2 flex-1 min-h-0">
        {PLANS.map((plan, i) => (
          <div
            key={plan.key}
            className="flex-1 min-h-0 opacity-0 animate-fade-up"
            style={{ animationDelay: `${0.12 + i * 0.08}s` }}
          >
            <PlanCard plan={plan} onClick={() => pick(plan.key)} />
          </div>
        ))}
      </div>
    </div>
  )
}
