import { useState, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  type?: 'text' | 'numeric'
  placeholder?: string
  label: string
  maxLength?: number
  onSubmit?: () => void
}

const ROWS_TEXT = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
]

const ROWS_NUM = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['⌫','0','OK'],
]

export default function CustomKeyboard({ value, onChange, type = 'text', placeholder, label, maxLength, onSubmit }: Props) {
  const [shift, setShift] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setShift(false)
  }, [type])

  const handleKey = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (key === 'OK') {
      onSubmit?.()
    } else if (type === 'numeric') {
      if (maxLength && value.length >= maxLength) return
      onChange(value + key)
    } else {
      if (maxLength && value.length >= maxLength) return
      onChange(value + (shift ? key : key.toLowerCase()))
      if (shift) setShift(false)
    }
  }

  const rows = type === 'numeric' ? ROWS_NUM : ROWS_TEXT

  return (
    <div>
      <label className="block text-[length:var(--fs-body)] font-bold text-navy mb-2 uppercase">
        {label}
      </label>
      <div
        ref={inputRef}
        className="w-full bg-white border-2 border-navy/15 rounded-lg px-4 py-3 text-[length:var(--fs-body)] text-navy font-semibold min-h-[52px] flex items-center"
      >
        {value ? (
          <span className="uppercase">{value}</span>
        ) : (
          <span className="text-navy/30">{placeholder}</span>
        )}
        <span className="ml-1 w-[2px] h-5 bg-gold animate-pulse" />
      </div>

      <div className="mt-2 bg-slate-100 rounded-lg p-2 space-y-1.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {type === 'text' && ri === 0 && (
              <button
                onClick={() => setShift(!shift)}
                className={`tap-scale h-10 min-w-[36px] rounded-md text-xs font-bold transition-colors ${
                  shift ? 'bg-navy text-white' : 'bg-white text-navy border border-navy/15'
                }`}
              >
                ⇧
              </button>
            )}
            {type === 'numeric' && ri === 0 && <div className="min-w-[36px]" />}
            {row.map(key => (
              <button
                key={key}
                onPointerDown={(e) => { e.preventDefault(); handleKey(key) }}
                className={`tap-scale h-10 min-w-[32px] flex-1 max-w-[42px] rounded-md text-sm font-bold transition-colors active:scale-95 ${
                  key === 'OK'
                    ? 'bg-gold text-white'
                    : key === '⌫'
                    ? 'bg-red-100 text-red-600 border border-red-200'
                    : 'bg-white text-navy border border-navy/15 hover:bg-navy/5'
                }`}
              >
                {key}
              </button>
            ))}
            {type === 'text' && ri === 0 && <div className="min-w-[36px]" />}
            {type === 'numeric' && ri === 0 && <div className="min-w-[36px]" />}
          </div>
        ))}
        {type === 'text' && (
          <div className="flex justify-center gap-1">
            <button
              onPointerDown={(e) => { e.preventDefault(); handleKey(' ') }}
              className="tap-scale h-10 flex-1 max-w-[200px] rounded-md text-sm font-bold bg-white text-navy border border-navy/15"
            >
              ESPACIO
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
