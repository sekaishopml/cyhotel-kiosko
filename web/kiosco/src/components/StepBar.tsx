interface Props {
  step: number
}

const labels = ['Plan', 'Habitación', 'Datos']

export default function StepBar({ step }: Props) {
  return (
    <div className="shrink-0 bg-white border-b border-navy/8 px-[var(--pad)] py-3 flex items-center justify-center gap-2">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`rounded-full transition-all duration-300 ${
                i < step
                  ? 'w-2.5 h-2.5 bg-sage'
                  : i === step
                  ? 'w-3.5 h-3.5 bg-navy'
                  : 'w-2.5 h-2.5 bg-navy/15'
              }`}
            />
            <span
              className={`text-[length:var(--fs-small)] font-semibold transition-colors duration-300 ${
                i <= step ? 'text-navy' : 'text-slate/50'
              }`}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`w-6 h-0.5 mx-1 transition-colors duration-300 ${
              i < step ? 'bg-sage' : 'bg-navy/10'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
