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
      onChange(value + key.toUpperCase())
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
        {rows.map((row) => (
          <div key={row.join('')} className={cn('flex w-full justify-center gap-1.5 sm:gap-2', type === 'numeric' ? 'max-w-[400px] mx-auto' : 'max-w-full')}>
            {row.map(key => (
              <button
                key={key}
                onPointerDown={(e) => { e.preventDefault(); handleKey(key) }}
                style={keyStyle}
                className={cn('tap-scale touch-manipulation', keyH, type === 'numeric' ? 'min-w-[48px] flex-1 max-w-[120px]' : 'min-w-[48px] flex-1', type === 'numeric' ? 'rounded-xl text-3xl font-bold transition-colors active:scale-95 shadow-sm' : 'rounded-xl text-2xl font-bold transition-colors active:scale-95 shadow-sm',
                  key === 'OK'
                    ? type === 'numeric'
                      ? 'bg-[var(--hc-verde-800)] text-white text-2xl'
                      : 'bg-[var(--hc-verde-800)] text-white text-xl'
                    : key === '⌫'
                    ? type === 'numeric'
                      ? 'bg-red-100 text-red-600 border border-red-200 text-2xl'
                      : 'bg-red-100 text-red-600 border border-red-200 text-xl'
                    : 'bg-white text-navy border border-navy/10 hover:bg-navy/5')}
              >
                {key}
              </button>
            ))}
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
            <button
              onPointerDown={(e) => { e.preventDefault(); tap(); onSubmit?.() }}
              style={keyStyle}
              className={cn('tap-scale touch-manipulation', keyH, 'shrink-0 px-6 rounded-xl text-base font-extrabold uppercase tracking-wider text-white bg-navy active:scale-95 shadow-sm')}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
