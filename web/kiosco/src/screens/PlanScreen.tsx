import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import PlanCard from '../components/PlanCard'
import { PLANS } from '../constants'

export default function PlanScreen() {
  const { selectPlan } = useStore()
  const navigate = useNavigate()
  const armedAt = useRef(Date.now())

  const pick = (key: string) => {
    if (Date.now() - armedAt.current < 500) return
    selectPlan(key)
    navigate('/room')
  }

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col bg-[var(--hc-papel)]" style={{ padding: 'var(--kiosk-margin)', paddingBottom: 'max(var(--kiosk-margin), env(safe-area-inset-bottom))' }}>
      <h2 className="plan-enter-title font-display text-[length:var(--fs-body)] text-navy font-bold uppercase tracking-wide text-center shrink-0" style={{ marginBottom: 'var(--gap)' }}>
        Elegí Tu Plan
      </h2>

      <div className="grid grid-cols-1 flex-1 min-h-0 min-w-0 overflow-y-auto no-scrollbar kiosk-scroll tablet-landscape:grid-cols-2 tablet-landscape:grid-rows-2" style={{ gap: 'var(--gap)', gridAutoRows: 'minmax(var(--tap),1fr)' }}>
        {PLANS.map((plan, i) => (
          <div
            key={plan.key}
            className="min-h-0 min-w-0 opacity-0 animate-fade-up"
            style={{ animationDelay: `${0.12 + i * 0.08}s` }}
          >
            <PlanCard plan={plan} onClick={() => pick(plan.key)} />
          </div>
        ))}
      </div>
    </div>
  )
}
