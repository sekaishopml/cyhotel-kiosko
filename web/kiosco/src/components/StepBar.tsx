interface Props {
  step: number
}

const labels = ['Plan', 'Habitación', 'Datos']
const totalSteps = labels.length

export default function StepBar({ step }: Props) {
  const progress = ((step) / (totalSteps - 1)) * 100

  return (
    <div className="shrink-0 bg-white border-b border-navy/5 px-4 py-3">
      <div className="relative h-1 bg-navy/8 rounded-full overflow-hidden mb-2.5">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold to-[#e6b98a] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        {labels.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-extrabold transition-all duration-300 ${
                i < step
                  ? 'bg-gold text-white'
                  : i === step
                  ? 'bg-navy text-white'
                  : 'bg-navy/10 text-navy/40'
              }`}
            >
              {i < step ? (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-[0.65rem] font-bold transition-colors duration-300 hidden sm:inline ${
                i <= step ? 'text-navy' : 'text-navy/30'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
