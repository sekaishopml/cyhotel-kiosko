import { useState } from 'react'
import CustomKeyboard from './ui/CustomKeyboard'
import { nameSchema } from '../lib/validation'

interface Props {
  planKey: string
  roomKey: string
  extra: string | null
  days: number
  roomPrice: number
  total: number
  onSubmit: (name: string, document: string, docType: 'ci' | 'passport') => void
  disabled?: boolean
}

type DocType = 'ci' | 'passport'

const planLabels: Record<string, string> = {
  momento: 'MOMENTO',
  amanecida: 'AMANECIDA',
  hospedaje: 'HOSPEDAJE',
  suite: 'SUITE JACUZZI',
}

const extraLabels: Record<string, string> = {
  momento: '3 horas',
  amanecida: '19:00 - 09:00',
  hospedaje: 'por noche',
}

const DOC_MAX: Record<DocType, number> = { ci: 10, passport: 9 }

export default function CheckinForm({ planKey, roomKey, extra, days, roomPrice, total, onSubmit, disabled }: Props) {
  const [name, setName] = useState('')
  const [doc, setDoc] = useState('')
  const [docType, setDocType] = useState<DocType>('ci')
  const [activeField, setActiveField] = useState<'name' | 'doc'>('name')
  const [nameError, setNameError] = useState(false)
  const [docError, setDocError] = useState(false)

  const validateName = () => {
    const ok = nameSchema.safeParse(name).success
    if (!ok) setNameError(true)
    return ok
  }

  const validateDoc = (value: string) => {
    const v = value.trim()
    if (!v) return true
    return docType === 'ci' ? /^\d{6,10}$/.test(v) : /^[A-Z0-9]{5,9}$/.test(v)
  }

  const handleDocChange = (val: string) => {
    setDoc(val)
    if (docError && validateDoc(val)) setDocError(false)
    const v = val.trim()
    const maxLen = DOC_MAX[docType]
    const minLen = docType === 'ci' ? 6 : 5
    if (v.length >= minLen && validateName() && validateDoc(v) && v.length === maxLen) {
      onSubmit(name.trim(), v, docType)
    }
  }

  const handleNameChange = (val: string) => {
    setName(val)
    if (nameError) setNameError(false)
  }

  const switchDocType = (t: DocType) => {
    setDocType(t)
    setDoc('')
    setDocError(false)
    setActiveField('doc')
  }

  const durationLabel = planKey === 'suite' && extra
    ? extraLabels[extra] ?? extra
    : planKey === 'amanecida' ? '18:00 - 09:00'
    : planKey === 'hospedaje' ? `${days} ${days === 1 ? 'noche' : 'noches'}`
    : '3 horas'

  return (
    <div className="flex-1 min-h-0 flex flex-col px-4 pb-3">
      {/* Resumen compacto arriba: siempre visible, sin scroll */}
      <div className="shrink-0 bg-white border-l-4 border-gold rounded-lg p-2.5 mb-2 card-shadow">
        <h3 className="text-[0.6rem] font-bold text-navy/40 uppercase tracking-widest mb-2">Resumen de tu reserva</h3>
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
            <span className="text-xl font-extrabold text-[var(--hc-verde-800)]">${total}</span>
          </div>
        </div>
      </div>

      {/* Centro: ÚNICA región con scroll (campos). El teclado queda fijo abajo. */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="shrink-0 space-y-2 pb-2">
          <div
            onClick={() => setActiveField('name')}
            className={`rounded-lg border-2 p-2.5 transition-all cursor-pointer ${
              activeField === 'name' ? 'border-gold shadow-[0_0_0_3px_rgba(176,141,87,0.15)]' : 'border-navy/10'
            } ${nameError ? 'border-red-400' : ''}`}
          >
            <p className="text-[0.6rem] font-bold text-navy/40 uppercase mb-0.5">Nombre completo *</p>
            <p className="text-[length:var(--fs-small)] font-bold text-navy uppercase min-h-[20px]">
              {name || <span className="text-navy/20">Toca para escribir</span>}
            </p>
            {nameError && (
              <p className="text-[0.7rem] font-bold text-red-500 mt-1">Escriba su nombre</p>
            )}
          </div>

          <div
            onClick={() => setActiveField('doc')}
            className={`rounded-lg border-2 p-2.5 transition-all cursor-pointer ${
              activeField === 'doc' ? 'border-gold shadow-[0_0_0_3px_rgba(176,141,87,0.15)]' : 'border-navy/10'
            } ${docError ? 'border-red-400' : ''}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[0.6rem] font-bold text-navy/40 uppercase">Documento (opcional)</p>
              <div className="flex gap-1">
                <button
                  onPointerDown={(e) => { e.stopPropagation(); switchDocType('ci') }}
                  className={`tap-scale px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-wider border transition-colors ${
                    docType === 'ci' ? 'bg-navy text-white border-navy' : 'text-navy/50 border-navy/15'
                  }`}
                >
                  CI
                </button>
                <button
                  onPointerDown={(e) => { e.stopPropagation(); switchDocType('passport') }}
                  className={`tap-scale px-2.5 py-0.5 rounded-full text-[0.6rem] font-extrabold uppercase tracking-wider border transition-colors ${
                    docType === 'passport' ? 'bg-navy text-white border-navy' : 'text-navy/50 border-navy/15'
                  }`}
                >
                  Pasaporte
                </button>
              </div>
            </div>
            <p className={`font-bold text-navy min-h-[28px] ${doc ? 'text-2xl tracking-widest' : 'text-[length:var(--fs-small)]'}`}>
              {doc || <span className="text-navy/20">Toca para escribir</span>}
            </p>
            {docError && (
              <p className="text-[0.7rem] font-bold text-red-500 mt-1">
                {docType === 'ci' ? 'Ingrese 6 a 10 dígitos' : 'Ingrese 5 a 9 caracteres'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Teclado en zona fija abajo (fuera del scroll, con min-h-0) */}
      <div className="shrink-0 min-h-0 relative z-10">
        {activeField === 'name' ? (
          <CustomKeyboard
            value={name}
            onChange={handleNameChange}
            type="text"
            placeholder="TU NOMBRE"
            label="Nombre"
            maxLength={40}
            onSubmit={() => {
              if (!validateName()) return
              setNameError(false)
              setActiveField('doc')
            }}
          />
        ) : docType === 'ci' ? (
          <CustomKeyboard
            value={doc}
            onChange={handleDocChange}
            type="numeric"
            label="Cédula"
            maxLength={DOC_MAX.ci}
            onSubmit={() => {
              if (!validateName()) { setNameError(true); setActiveField('name'); return }
              if (!doc.trim() || validateDoc(doc)) {
                onSubmit(name.trim(), doc.trim(), docType)
              } else {
                setDocError(true)
              }
            }}
          />
        ) : (
          <CustomKeyboard
            value={doc}
            onChange={handleDocChange}
            type="text"
            label="Pasaporte"
            maxLength={DOC_MAX.passport}
            onSubmit={() => {
              if (!validateName()) { setNameError(true); setActiveField('name'); return }
              if (!doc.trim() || validateDoc(doc)) {
                onSubmit(name.trim(), doc.trim(), docType)
              } else {
                setDocError(true)
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
