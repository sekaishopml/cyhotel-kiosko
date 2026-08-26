import { motion } from 'framer-motion'
import { EASE } from '../lib/animations'

interface StepIndicatorProps {
  currentStep: number
}

const steps = ['Plan', 'Habitación', 'Datos'] as const

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 h-10">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          {i > 0 && (
            <div className="w-8 h-[2px] bg-verde-900/15" />
          )}
          <div className="flex flex-col items-center">
            <motion.div
              layout
              className={
                i < currentStep
                  ? 'rounded-full bg-verde-500'
                  : i === currentStep
                    ? 'rounded-full bg-verde-900'
                    : 'rounded-full border border-verde-900/20'
              }
              animate={{
                width: i === currentStep ? 14 : 10,
                height: i === currentStep ? 14 : 10,
                scale: i === currentStep ? 1 : 1,
              }}
              transition={{ duration: 0.35, ease: EASE }}
            />
            <span className="text-[0.6rem] text-verde-900/60 mt-1 font-sans whitespace-nowrap">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
