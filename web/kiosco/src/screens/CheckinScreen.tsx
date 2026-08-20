import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp } from '../lib/animations'
import { createOrder } from '../api/client'
import Modal from '../components/Modal'

interface Props {
  planKey: string
  roomKey: string
  extra: string | null
  days: number
  onBack: () => void
  onSuccess: () => void
}

const planLabels: Record<string, string> = {
  momento: 'Momento',
  amanecida: 'Amanecida',
  hospedaje: 'Hospedaje',
  suite_jacuzzi: 'Suite Jacuzzi',
}

export default function CheckinScreen({ planKey, roomKey, extra, days, onBack, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<{
    id: string
    room_number: string
    check_in: string
    check_out: string
    amount: number
  } | null>(null)

  const canSubmit = name.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const result = await createOrder({
        product: planKey,
        room_type: roomKey,
        guest_name: name.trim(),
        id_document: document.trim() || undefined,
        client_ref: `kiosco-${Date.now()}`,
        extra: extra ?? undefined,
        days: planKey === 'hospedaje' ? days : undefined,
      })
      setOrder(result.order)
    } catch {
      setError('No se pudo completar la reserva. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <motion.div className="h-full flex flex-col" {...fadeInUp}>
        <div className="shrink-0 px-6 pt-4 pb-2 flex items-center gap-3">
          <button onClick={onBack} className="text-verde-600 hover:text-verde-900 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-serif text-2xl text-verde-900 font-semibold">Check-in</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          <div className="bg-crema rounded-2xl p-5 space-y-2 mb-6">
            <p className="text-sm"><span className="font-semibold text-verde-900">Plan:</span> {planLabels[planKey] ?? planKey}</p>
            <p className="text-sm"><span className="font-semibold text-verde-900">Habitación:</span> {roomKey}</p>
            {extra && <p className="text-sm"><span className="font-semibold text-verde-900">Duración:</span> {extra}</p>}
            {planKey === 'hospedaje' && (
              <p className="text-sm"><span className="font-semibold text-verde-900">Noches:</span> {days}</p>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-verde-900 mb-1">Nombre completo *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-verde-900/20 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:border-verde-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-verde-900 mb-1">Documento (opcional)</label>
              <input
                type="text"
                value={document}
                onChange={e => setDocument(e.target.value)}
                placeholder="DNI o pasaporte"
                className="w-full rounded-xl border border-verde-900/20 px-4 py-3 text-ink placeholder:text-ink/30 focus:outline-none focus:border-verde-600 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-verde-900/10">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="w-full bg-verde-900 text-white rounded-2xl py-4 font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-verde-700 transition-colors"
          >
            {loading ? 'Confirmando…' : 'Confirmar Reserva'}
          </motion.button>
        </div>
      </motion.div>

      {order && (
        <Modal
          open
          onClose={onSuccess}
          orderId={order.id}
          roomNumber={order.room_number}
          checkIn={order.check_in}
          checkOut={order.check_out}
          amount={order.amount}
        />
      )}
    </>
  )
}
