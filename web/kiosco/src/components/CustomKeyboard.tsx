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
    }
  }

  const rows = type === 'numeric' ? ROWS_NUM : ROWS_TEXT

  const keyH = type === 'numeric' ? 'h-[68px]' : 'h-[56px]'

  return (
    <div className="flex flex-col h-full relative z-20">
      <div className="flex-1 bg-slate-100 rounded-t-xl p-2.5 flex flex-col justify-center gap-2">
        {rows.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-2">
            {type === 'text' && ri === 0 && (
              <button
                onPointerDown={(e) => { e.preventDefault(); setShift(!shift) }}
                className={`tap-scale ${keyH} min-w-[52px] rounded-xl text-base font-bold transition-colors ${
                  shift ? 'bg-navy text-white' : 'bg-white text-navy border border-navy/15'
                }`}
              >
                ⇧
              </button>
            )}
            {type === 'numeric' && ri === 0 && <div className="min-w-[52px]" />}
            {row.map(key => (
              <button
                key={key}
                onPointerDown={(e) => { e.preventDefault(); handleKey(key) }}
                className={`tap-scale ${keyH} min-w-[48px] flex-1 max-w-[72px] rounded-xl text-2xl font-bold transition-colors active:scale-95 shadow-sm ${
                  key === 'OK'
                    ? 'bg-gold text-white text-xl'
                    : key === '⌫'
                    ? 'bg-red-100 text-red-600 border border-red-200 text-xl'
                    : 'bg-white text-navy border border-navy/10 hover:bg-navy/5'
                }`}
              >
                {key}
              </button>
            ))}
            {type === 'text' && ri === 0 && <div className="min-w-[52px]" />}
            {type === 'numeric' && ri === 0 && <div className="min-w-[52px]" />}
          </div>
        ))}
        {type === 'text' && (
          <div className="flex justify-center gap-2">
            <button
              onPointerDown={(e) => { e.preventDefault(); handleKey(' ') }}
              className={`tap-scale ${keyH} flex-1 max-w-[280px] rounded-xl text-base font-bold bg-white text-navy border border-navy/15`}
            >
              ESPACIO
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
