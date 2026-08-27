import { useState } from 'react'
import { useStore } from '../store'
import { createOrder, enqueueOrder } from '../api'
import CheckinForm from '../components/CheckinForm'
import ConfirmModal from '../components/ConfirmModal'
import OfflineModal from '../components/OfflineModal'

export default function CheckinScreen() {
  const { selectedPlan, selectedRoom, selectedExtra, selectedDays, goBack, goHome } = useStore()
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<{
    id: string; room_number: string; check_in: string; check_out: string; amount: number
  } | null>(null)
  const [offline, setOffline] = useState(false)

  const handleSubmit = async (name: string, document: string) => {
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
    }
  }

  const total = selectedPlan === 'suite' && selectedExtra
    ? (selectedExtra === 'momento' ? 20 : selectedExtra === 'amanecida' ? 35 : 50)
    : selectedPlan === 'hospedaje'
    ? (selectedRoom === 'estandar' ? 30 : selectedRoom === 'matrimonial' ? 30 : 40) * selectedDays
    : selectedRoom === 'estandar' ? 10
    : selectedRoom === 'matrimonial' ? 12
    : 12

  const roomPrice = selectedPlan === 'suite' && selectedExtra
    ? (selectedExtra === 'momento' ? 20 : selectedExtra === 'amanecida' ? 35 : 50)
    : selectedPlan === 'hospedaje'
    ? (selectedRoom === 'estandar' ? 30 : selectedRoom === 'matrimonial' ? 30 : 40)
    : selectedRoom === 'estandar' ? 10
    : selectedRoom === 'matrimonial' ? 12
    : 12

  return (
    <>
      <div className="h-full flex flex-col slide-in-right">
        <div className="shrink-0 px-4 pb-2 pt-1">
          <div className="h-[3px] bg-navy/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold to-amber-500 rounded-full progress-fill" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="shrink-0 px-4 py-2 flex items-center gap-3">
          <button onClick={goBack} className="tap-scale w-9 h-9 rounded-full bg-navy/8 flex items-center justify-center text-navy hover:bg-navy/15 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
        />
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 text-center shadow-lg">
            <div className="w-10 h-10 border-[3px] border-navy/15 border-t-navy rounded-full animate-spin mx-auto" />
            <p className="mt-3 font-bold text-navy uppercase text-[length:var(--fs-small)]">Confirmando…</p>
          </div>
        </div>
      )}

      {order && (
        <ConfirmModal
          orderId={order.id}
          roomNumber={order.room_number}
          checkIn={order.check_in}
          checkOut={order.check_out}
          amount={order.amount}
          onClose={goHome}
        />
      )}

      {offline && <OfflineModal onClose={goHome} />}
    </>
  )
}
