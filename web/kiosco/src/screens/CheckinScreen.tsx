import { useState, useRef } from 'react'
import { useStore } from '../store'
import { createOrder, enqueueOrder } from '../api'
import { computeTotal } from '../lib/pricing'
import CheckinForm from '../components/CheckinForm'
import ConfirmModal from '../components/ui/ConfirmModal'
import OfflineModal from '../components/ui/OfflineModal'

export default function CheckinScreen() {
  const { selectedPlan, selectedRoom, selectedExtra, selectedDays, catalog, goBack, goHome } = useStore()
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)
  const [order, setOrder] = useState<{
    id: string; room_number: string; check_in: string; check_out: string; subtotal: number
  } | null>(null)
  const [offline, setOffline] = useState(false)

  const handleSubmit = async (name: string, document: string) => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      const result = await createOrder({
        product: selectedPlan!,
        room_type: selectedRoom!,
        guest_name: name,
        id_document: document || undefined,
        client_ref: `kiosco-${Date.now()}`,
        extra: selectedExtra ?? undefined,
        days: selectedPlan === 'hospedaje' ? selectedDays : undefined,
      })
      setOrder(result.order)
    } catch {
      enqueueOrder({
        product: selectedPlan!,
        room_type: selectedRoom!,
        guest_name: name,
        id_document: document || undefined,
        client_ref: `kiosco-${Date.now()}`,
        extra: selectedExtra ?? undefined,
        days: selectedPlan === 'hospedaje' ? selectedDays : undefined,
      })
      setOffline(true)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const total = computeTotal(selectedPlan!, selectedRoom!, selectedExtra, selectedDays, catalog)

  const roomPrice = selectedPlan === 'hospedaje'
    ? (catalog?.find(r => r.key === selectedRoom)?.price ?? 0)
    : selectedPlan === 'suite' && selectedExtra
    ? computeTotal('suite', selectedRoom!, selectedExtra, selectedDays, catalog)
    : (catalog?.find(r => r.key === selectedRoom)?.price ?? 0)

  return (
    <>
      <div className="h-full flex flex-col slide-in-right">
        <div className="shrink-0 px-4 pb-2 pt-1">
          <div className="h-[3px] bg-navy/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold to-amber-500 rounded-full progress-fill" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="shrink-0 px-4 py-2 flex items-center gap-3">
          <button onClick={goBack} className="tap-scale w-12 h-12 rounded-full bg-navy/8 flex items-center justify-center text-navy hover:bg-navy/15 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-display text-[length:var(--fs-body)] text-navy font-bold uppercase">
            Check-In
          </h2>
        </div>

        <CheckinForm
          planKey={selectedPlan!}
          roomKey={selectedRoom!}
          extra={selectedExtra}
          days={selectedDays}
          roomPrice={roomPrice}
          total={total}
          onSubmit={handleSubmit}
          disabled={loading}
        />
      </div>

      {loading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/50">
          <div className="bg-white rounded-2xl px-10 py-8 text-center shadow-2xl animate-pop">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 border-4 border-navy/10 border-t-gold rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-bold text-navy text-lg uppercase">Confirmando reserva…</p>
            <p className="mt-1 text-sm text-navy/40 font-semibold">Procesando en recepción</p>
            <div className="w-40 h-1 bg-navy/10 rounded-full overflow-hidden mx-auto mt-4">
              <div className="h-full bg-gradient-to-r from-gold to-amber-400 rounded-full" style={{ animation: 'confirmProgress 2s ease-in-out infinite' }} />
            </div>
          </div>
        </div>
      )}

      {order && (
        <ConfirmModal
          orderId={order.id}
          roomNumber={order.room_number}
          checkIn={order.check_in}
          checkOut={order.check_out}
          subtotal={order.subtotal}
          onClose={goHome}
        />
      )}

      {offline && <OfflineModal onClose={goHome} />}
    </>
  )
}
