interface Props {
  step: number
}

const labels = ['Plan', 'Habitación', 'Datos']

export default function StepBar({ step }: Props) {
  return (
    <div className="shrink-0 bg-white border-b border-navy/6 px-[var(--pad)] py-3 flex items-center justify-center gap-3">
      {labels.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`rounded-full transition-all duration-400 ease-out ${
                i < step
                  ? 'w-2.5 h-2.5 bg-gold'
                  : i === step
                  ? 'w-4 h-4 bg-navy ring-2 ring-navy/15'
                  : 'w-2.5 h-2.5 bg-navy/12'
              }`}
            />
            <span
              className={`text-[length:0.75rem] font-bold transition-colors duration-300 ${
                i <= step ? 'text-navy' : 'text-slate/40'
              }`}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className="relative w-8 h-0.5 mx-1 bg-navy/8 rounded-full overflow-hidden">
              {i < step && (
                <div className="absolute inset-0 bg-gold rounded-full progress-fill" />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
