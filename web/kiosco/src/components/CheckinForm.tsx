import { useState } from 'react'

interface Props {
  planKey: string
  roomKey: string
  extra: string | null
  days: number
  onSubmit: (name: string, document: string) => void
}

export default function CheckinForm({ planKey, roomKey, extra, days, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')

  const planLabels: Record<string, string> = {
    momento: 'MOMENTO',
    amanecida: 'AMANECIDA',
    hospedaje: 'HOSPEDAJE',
    suite: 'SUITE JACUZZI',
  }

  const canSubmit = name.trim().length > 0

  return (
    <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar px-[var(--pad)] pb-[var(--gap)]">
      <div className="bg-white border-l-4 border-gold rounded-2xl p-4 space-y-2 mb-5">
        <p className="text-[length:var(--fs-body)]">
          <span className="font-bold text-navy">PLAN:</span>{' '}
          <span className="font-semibold uppercase">{planLabels[planKey] ?? planKey}</span>
        </p>
        <p className="text-[length:var(--fs-body)]">
          <span className="font-bold text-navy">HABITACIÓN:</span>{' '}
          <span className="font-semibold uppercase">{roomKey}</span>
        </p>
        {extra && (
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">DURACIÓN:</span>{' '}
            <span className="font-semibold uppercase">{extra}</span>
          </p>
        )}
        {planKey === 'hospedaje' && (
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">NOCHES:</span>{' '}
            <span className="font-semibold">{days}</span>
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[length:var(--fs-body)] font-bold text-navy mb-2 uppercase">
            Nombre completo
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="TU NOMBRE"
            className="w-full rounded-2xl border-2 border-navy/15 bg-white px-5 py-[var(--pad)] text-[length:var(--fs-body)] text-navy placeholder:text-slate/40 uppercase font-semibold focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
          />
        </div>
        <div>
          <label className="block text-[length:var(--fs-body)] font-bold text-navy mb-2 uppercase">
            Documento (opcional)
          </label>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Sin puntos ni espacios"
            value={doc}
            onChange={e => setDoc(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-white border-2 border-navy/12 rounded-2xl px-4 py-3 text-[length:var(--fs-body)] text-navy font-semibold placeholder:text-navy/30 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
          />
        </div>
      </div>

      <div className="mt-auto pt-5">
        <button
          onClick={() => onSubmit(name.trim(), doc.trim())}
          disabled={!canSubmit}
          className="tap-scale w-full bg-navy text-white rounded-2xl py-[var(--pad)] font-extrabold text-[length:var(--fs-section)] uppercase tracking-wide disabled:opacity-30 disabled:cursor-not-allowed hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Confirmar Reserva
        </button>
      </div>
    </div>
  )
}
