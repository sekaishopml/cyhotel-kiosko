import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp } from '../lib/animations'
import { createOrder } from '../api/client'
import { enqueueOrder } from '../lib/offlineQueue'
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
  const [offline, setOffline] = useState(false)

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
      // Backend no disponible: guardamos la reserva en el tablet y se sincroniza sola.
      enqueueOrder({
        product: planKey,
        room_type: roomKey,
        guest_name: name.trim(),
        id_document: document.trim() || undefined,
        client_ref: `kiosco-${Date.now()}`,
        extra: extra ?? undefined,
        days: planKey === 'hospedaje' ? days : undefined,
      })
      setError(null)
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <motion.div className="h-full flex flex-col" {...fadeInUp}>
        <div className="shrink-0 px-[var(--pad)] pt-[var(--gap)] pb-[var(--gap)] flex items-center gap-3">
          <button onClick={onBack} className="text-verde-600 hover:text-verde-900 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-serif text-[length:var(--fs-section)] text-verde-900 font-semibold">Check-in</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden px-[var(--pad)] pb-[var(--gap)]">
          <div className="bg-crema rounded-2xl p-5 space-y-2 mb-6">
            <p className="text-[length:var(--fs-small)]"><span className="font-semibold text-verde-900">Plan:</span> {planLabels[planKey] ?? planKey}</p>
            <p className="text-[length:var(--fs-small)]"><span className="font-semibold text-verde-900">Habitación:</span> {roomKey}</p>
            {extra && <p className="text-[length:var(--fs-small)]"><span className="font-semibold text-verde-900">Duración:</span> {extra}</p>}
            {planKey === 'hospedaje' && (
              <p className="text-[length:var(--fs-small)]"><span className="font-semibold text-verde-900">Noches:</span> {days}</p>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[length:var(--fs-small)] font-medium text-verde-900 mb-1">Nombre completo *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-verde-900/20 px-4 py-[var(--pad)] text-ink placeholder:text-ink/30 focus:outline-none focus:border-verde-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[length:var(--fs-small)] font-medium text-verde-900 mb-1">Documento (opcional)</label>
              <input
                type="text"
                value={document}
                onChange={e => setDocument(e.target.value)}
                placeholder="DNI o pasaporte"
                className="w-full rounded-xl border border-verde-900/20 px-4 py-[var(--pad)] text-ink placeholder:text-ink/30 focus:outline-none focus:border-verde-600 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-[length:var(--fs-small)] mb-4 text-center">{error}</p>
          )}
        </div>

        <div className="shrink-0 px-[var(--pad)] py-[var(--gap)] border-t border-verde-900/10">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="w-full bg-verde-900 text-white rounded-2xl py-[var(--pad)] font-semibold text-[length:var(--fs-body)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-verde-700 transition-colors"
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
      {offline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onSuccess}>
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-3xl">⏳</div>
            <p className="mt-3 text-[length:var(--fs-body)] font-semibold">Reserva guardada</p>
            <p className="mt-1 text-[length:var(--fs-small)] opacity-70">
              No hay conexión con recepción ahora. Se enviará automáticamente en cuanto vuelva.
            </p>
            <button
              onClick={onSuccess}
              className="mt-4 px-6 py-3 rounded-2xl bg-[var(--accent)] text-black font-bold text-[length:var(--fs-body)]"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  )
}
