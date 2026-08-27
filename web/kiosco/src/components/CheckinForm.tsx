import { useState } from 'react'
import CustomKeyboard from './CustomKeyboard'

interface Props {
  planKey: string
  roomKey: string
  extra: string | null
  days: number
  roomPrice: number
  total: number
  onSubmit: (name: string, document: string) => void
}

const planLabels: Record<string, string> = {
  momento: 'MOMENTO',
  amanecida: 'AMANECIDA',
  hospedaje: 'HOSPEDAJE',
  suite: 'SUITE JACUZZI',
}

const extraLabels: Record<string, string> = {
  momento: '3 horas',
  amanecida: '18:00 - 09:00',
  hospedaje: 'por noche',
}

export default function CheckinForm({ planKey, roomKey, extra, days, roomPrice, total, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [activeField, setActiveField] = useState<'name' | 'doc'>('name')

  const canSubmit = name.trim().length > 0

  const durationLabel = planKey === 'suite' && extra
    ? extraLabels[extra] ?? extra
    : planKey === 'amanecida' ? '18:00 - 09:00'
    : planKey === 'hospedaje' ? `${days} ${days === 1 ? 'noche' : 'noches'}`
    : '3 horas'

  return (
    <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar px-[var(--pad)] pb-[var(--gap)]">
      <div className="bg-white border-l-4 border-gold rounded-lg p-4 mb-4">
        <h3 className="text-[0.7rem] font-bold text-navy/50 uppercase tracking-widest mb-3">Resumen del pedido</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[length:var(--fs-small)] text-navy/60 font-semibold">Plan</span>
            <span className="text-[length:var(--fs-small)] font-extrabold text-navy uppercase">{planLabels[planKey] ?? planKey}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[length:var(--fs-small)] text-navy/60 font-semibold">Habitación</span>
            <span className="text-[length:var(--fs-small)] font-extrabold text-navy uppercase">{roomKey}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[length:var(--fs-small)] text-navy/60 font-semibold">Duración</span>
            <span className="text-[length:var(--fs-small)] font-extrabold text-navy uppercase">{durationLabel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[length:var(--fs-small)] text-navy/60 font-semibold">Precio base</span>
            <span className="text-[length:var(--fs-small)] font-extrabold text-navy">${roomPrice}</span>
          </div>
          <div className="border-t border-navy/10 pt-2 mt-2 flex justify-between items-center">
            <span className="text-[length:var(--fs-body)] font-bold text-navy uppercase">Total</span>
            <span className="text-2xl font-extrabold text-gold">${total}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div
          onClick={() => setActiveField('name')}
          className={`rounded-lg border-2 p-3 transition-all cursor-pointer ${
            activeField === 'name' ? 'border-gold shadow-[0_0_0_3px_rgba(212,175,55,0.15)]' : 'border-navy/10'
          }`}
        >
          <p className="text-[0.65rem] font-bold text-navy/40 uppercase mb-1">Nombre completo *</p>
          <p className="text-[length:var(--fs-body)] font-bold text-navy uppercase min-h-[24px]">
            {name || <span className="text-navy/20">Toca para escribir</span>}
          </p>
        </div>
        <div
          onClick={() => setActiveField('doc')}
          className={`rounded-lg border-2 p-3 transition-all cursor-pointer ${
            activeField === 'doc' ? 'border-gold shadow-[0_0_0_3px_rgba(212,175,55,0.15)]' : 'border-navy/10'
          }`}
        >
          <p className="text-[0.65rem] font-bold text-navy/40 uppercase mb-1">Documento (opcional)</p>
          <p className="text-[length:var(--fs-body)] font-bold text-navy min-h-[24px]">
            {doc || <span className="text-navy/20">Toca para escribir</span>}
          </p>
        </div>
      </div>

      <div className="mt-auto">
        {activeField === 'name' ? (
          <CustomKeyboard
            value={name}
            onChange={setName}
            type="text"
            placeholder="TU NOMBRE"
            label="Nombre"
            maxLength={40}
            onSubmit={() => setActiveField('doc')}
          />
        ) : (
          <CustomKeyboard
            value={doc}
            onChange={setDoc}
            type="numeric"
            placeholder="Sin puntos ni espacios"
            label="Documento"
            maxLength={12}
          />
        )}

        <button
          onClick={() => onSubmit(name.trim(), doc.trim())}
          disabled={!canSubmit}
          className="tap-scale w-full bg-navy text-white rounded-lg py-3 mt-4 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide disabled:opacity-30 disabled:cursor-not-allowed hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Confirmar Reserva
        </button>
      </div>
    </div>
  )
}
