import { Plan } from '../types'
import { cn } from '../lib/cn'
import { tap } from '../lib/haptics'

interface Props {
  plan: Plan
  onClick: () => void
}

export default function PlanCard({ plan, onClick }: Props) {
  const isSuite = plan.key === 'suite'

  return (
    <button
      onPointerDown={() => tap()}
      onClick={onClick}
      className={cn('tap-scale relative w-full h-full min-h-[var(--tap)] rounded-lg flex flex-col items-center justify-center text-center transition-all duration-200',
        plan.hero
          ? 'bg-navy/95 text-white shadow-[0_4px_24px_rgba(18,53,38,0.25)] backdrop-blur-[2px]'
          : isSuite
          ? 'bg-navy/95 text-white shadow-[0_4px_24px_rgba(18,53,38,0.25)] backdrop-blur-[2px]'
          : 'bg-white/95 text-navy card-shadow backdrop-blur-[2px]')}
      >
        {plan.badge && (
          <span className="absolute top-2 right-3 text-[0.6rem] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--hc-verde-50)] text-[var(--hc-verde-800)]">
            {plan.badge}
          </span>
        )}
      <span className="font-sans text-[length:var(--fs-plan-name)] font-extrabold uppercase tracking-wide leading-none">
        {plan.name}
      </span>
    </button>
  )
}
