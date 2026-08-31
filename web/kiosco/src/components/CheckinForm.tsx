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
  disabled?: boolean
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

export default function CheckinForm({ planKey, roomKey, extra, days, roomPrice, total, onSubmit, disabled }: Props) {
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [activeField, setActiveField] = useState<'name' | 'doc'>('name')

  const handleDocChange = (val: string) => {
    setDoc(val)
    if (val.trim().length >= 10) {
      onSubmit(name.trim(), val.trim())
    }
  }

  const durationLabel = planKey === 'suite' && extra
    ? extraLabels[extra] ?? extra
    : planKey === 'amanecida' ? '18:00 - 09:00'
    : planKey === 'hospedaje' ? `${days} ${days === 1 ? 'noche' : 'noches'}`
    : '3 horas'

  return (
    <div className="flex-1 flex flex-col min-h-0 px-4 pb-3">
      <div className="shrink-0 bg-white border-l-4 border-gold rounded-lg p-3 mb-3">
        <h3 className="text-[0.6rem] font-bold text-navy/40 uppercase tracking-widest mb-2">Resumen</h3>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[0.8rem] text-navy/50">Plan</span>
            <span className="text-[0.8rem] font-extrabold text-navy uppercase">{planLabels[planKey]}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[0.8rem] text-navy/50">Habitación</span>
            <span className="text-[0.8rem] font-extrabold text-navy uppercase">{roomKey}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[0.8rem] text-navy/50">Duración</span>
            <span className="text-[0.8rem] font-extrabold text-navy uppercase">{durationLabel}</span>
          </div>
          <div className="border-t border-navy/10 pt-1 mt-1 flex justify-between items-center">
            <span className="text-[0.9rem] font-bold text-navy">Total</span>
            <span className="text-xl font-extrabold text-gold">${total}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="shrink-0 space-y-2 mb-3">
          <div
            onClick={() => setActiveField('name')}
            className={`rounded-lg border-2 p-2.5 transition-all cursor-pointer ${
              activeField === 'name' ? 'border-gold shadow-[0_0_0_3px_rgba(212,175,55,0.15)]' : 'border-navy/10'
            }`}
          >
            <p className="text-[0.6rem] font-bold text-navy/40 uppercase mb-0.5">Nombre completo *</p>
            <p className="text-[length:var(--fs-small)] font-bold text-navy uppercase min-h-[20px]">
              {name || <span className="text-navy/20">Toca para escribir</span>}
            </p>
          </div>
          <div
            onClick={() => setActiveField('doc')}
            className={`rounded-lg border-2 p-2.5 transition-all cursor-pointer ${
              activeField === 'doc' ? 'border-gold shadow-[0_0_0_3px_rgba(212,175,55,0.15)]' : 'border-navy/10'
            }`}
          >
            <p className="text-[0.6rem] font-bold text-navy/40 uppercase mb-0.5">Documento (opcional)</p>
            <p className={`font-bold text-navy min-h-[28px] ${doc ? 'text-2xl tracking-widest' : 'text-[length:var(--fs-small)]'}`}>
              {doc || <span className="text-navy/20">Toca para escribir</span>}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative z-10">
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
              onChange={handleDocChange}
              type="numeric"
              label="Documento"
              maxLength={10}
              onSubmit={() => onSubmit(name.trim(), doc.trim())}
            />
          )}
        </div>
      </div>
    </div>
  )
}
