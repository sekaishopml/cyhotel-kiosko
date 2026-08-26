import { Plan } from '../types'

interface Props {
  plan: Plan
  onClick: () => void
}

export default function PlanCard({ plan, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`tap-scale relative w-full h-full min-h-[var(--tap)] rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 ${
        plan.hero
          ? 'bg-navy text-white shadow-[0_4px_24px_rgba(15,23,42,0.25)]'
          : 'bg-white text-navy card-shadow'
      }`}
    >
      {plan.badge && (
        <span className="absolute top-2.5 right-3 text-[0.6rem] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-gold/20 text-gold">
          {plan.badge}
        </span>
      )}
      <span className="font-sans text-[length:var(--fs-plan-name)] font-extrabold uppercase tracking-wide leading-none">
        {plan.name}
      </span>
    </button>
  )
}
