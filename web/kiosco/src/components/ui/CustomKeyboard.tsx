import { useState, useEffect } from 'react'
import { cn } from '../../lib/cn'
import { tap } from '../../lib/haptics'

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
    tap()
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

  // P1b táctil: teclas con min-height 64px+ y altura fluida.
  // La clase aporta fallback con svh; el style pisa con dvh donde hay soporte
  // (mismo patrón svh->dvh que index.css). Así el teclado encaja en 1024x600
  // horizontal y crece en pantallas más altas sin cambiar props ni conducta.
  const keyH =
    type === 'numeric'
      ? 'min-h-[64px] h-[clamp(64px,10svh,84px)]'
      : 'min-h-[64px] h-[clamp(64px,8.5svh,76px)]'
  const keyStyle =
    type === 'numeric'
      ? { height: 'clamp(64px, 10dvh, 84px)' }
      : { height: 'clamp(64px, 8.5dvh, 76px)' }

  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden relative z-20">
      <div
        className="flex-1 min-h-0 bg-[var(--hc-verde-50)] rounded-t-xl p-2.5 pt-2 flex flex-col justify-end gap-1.5 sm:gap-2"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
      >
        {rows.map((row, ri) => (
          <div key={ri} className="flex w-full max-w-full justify-center gap-1.5 sm:gap-2">
            {type === 'text' && ri === 0 && (
              <button
                onPointerDown={(e) => { e.preventDefault(); tap(); setShift(!shift) }}
                style={keyStyle}
                className={cn('tap-scale touch-manipulation', keyH, 'w-[52px] shrink-0 rounded-xl text-base font-bold transition-colors',
                  shift ? 'bg-navy text-white' : 'bg-white text-navy border border-navy/15')}
              >
                ⇧
              </button>
            )}
            {type === 'numeric' && ri === 0 && <div className="w-[52px] shrink-0" aria-hidden="true" />}
            {row.map(key => (
              <button
                key={key}
                onPointerDown={(e) => { e.preventDefault(); handleKey(key) }}
                style={keyStyle}
                className={cn('tap-scale touch-manipulation', keyH, 'min-w-[48px] flex-1 max-w-[72px] rounded-xl text-2xl font-bold transition-colors active:scale-95 shadow-sm',
                  key === 'OK'
                    ? 'bg-[var(--hc-verde-800)] text-white text-xl'
                    : key === '⌫'
                    ? 'bg-red-100 text-red-600 border border-red-200 text-xl'
                    : 'bg-white text-navy border border-navy/10 hover:bg-navy/5')}
              >
                {key}
              </button>
            ))}
            {type === 'text' && ri === 0 && <div className="w-[52px] shrink-0" aria-hidden="true" />}
            {type === 'numeric' && ri === 0 && <div className="w-[52px] shrink-0" aria-hidden="true" />}
          </div>
        ))}
        {type === 'text' && (
          <div className="flex w-full max-w-full justify-center gap-2">
            <button
              onPointerDown={(e) => { e.preventDefault(); handleKey(' ') }}
              style={keyStyle}
              className={cn('tap-scale touch-manipulation', keyH, 'flex-1 max-w-[280px] rounded-xl text-base font-bold bg-white text-navy border border-navy/15')}
            >
              ESPACIO
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
