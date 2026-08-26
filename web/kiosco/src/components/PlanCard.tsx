import { Plan } from '../types'

interface Props {
  plan: Plan
  onClick: () => void
}

export default function PlanCard({ plan, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`tap-scale relative w-full h-full min-h-[var(--tap)] rounded-2xl flex flex-col items-center justify-center text-center border-2 transition-all duration-200 ${
        plan.hero
          ? 'bg-navy text-white border-navy card-shadow'
          : 'bg-white text-navy border-gold/20 card-shadow'
      }`}
    >
      {plan.badge && (
        <span className={`absolute top-3 right-3 text-[length:0.65rem] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
          plan.hero ? 'bg-gold/25 text-gold' : 'bg-gold/10 text-gold'
        }`}>
          {plan.badge}
        </span>
      )}
      <span className="font-sans text-[length:var(--fs-plan-name)] font-extrabold uppercase tracking-wide leading-none">
        {plan.name}
      </span>
    </button>
  )
}
