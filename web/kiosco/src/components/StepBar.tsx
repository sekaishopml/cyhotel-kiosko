interface Props {
  step: number
}

const totalSteps = 3

export default function StepBar({ step }: Props) {
  const progress = ((step) / (totalSteps - 1)) * 100

  return (
    <div className="shrink-0 bg-white px-0 py-0 border-b border-navy/5">
      <div className="relative h-[2px] bg-navy/8 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold to-[#e6b98a] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
