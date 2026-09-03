import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { createOrder, enqueueOrder } from '../api'
import { computeTotal } from '../lib/pricing'
import CheckinForm from '../components/CheckinForm'
import ConfirmModal from '../components/ui/ConfirmModal'
import OfflineModal from '../components/ui/OfflineModal'

// P1b layout: respeta prefers-reduced-motion desactivando las animaciones
// decorativas (progreso, spinner, pop). No toca la lógica de createOrder/enqueueOrder.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    mq.addListener(onChange)
    return () => mq.removeListener(onChange)
  }, [])
  return reduced
}

export default function CheckinScreen() {
  const { selectedPlan, selectedRoom, selectedExtra, selectedDays, catalog, goBack, goHome } = useStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)
  const [order, setOrder] = useState<{
    id: string; room_number: string; check_in: string; check_out: string; subtotal: number
  } | null>(null)
  const [offline, setOffline] = useState(false)
  const [persistError, setPersistError] = useState(false)
  const prefersReduced = usePrefersReducedMotion()

  const handleSubmit = async (name: string, document: string, docType: 'ci' | 'passport') => {
    if (submitting.current) return
    submitting.current = true
    setLoading(true)
    const idDocument = document ? `${docType === 'passport' ? 'PAS-' : 'CI-'}${document}` : undefined
    const payload = {
      product: selectedPlan!,
      room_type: selectedRoom!,
      guest_name: name,
      id_document: idDocument,
      client_ref: `kiosco-${Date.now()}`,
      extra: selectedExtra ?? undefined,
      days: selectedPlan === 'hospedaje' ? selectedDays : undefined,
    }
    try {
      const result = await createOrder(payload)
      setOrder(result.order)
    } catch {
      // Sin red: persiste en cola offline. Si el dispositivo no permite
      // persistir, NO se muestra "Reserva Pendiente" (sería falso éxito con
      // pérdida del pedido): se avisa y el huésped puede reintentar o ir a recepción.
      setPersistError(false)
      if (enqueueOrder(payload)) {
        setOffline(true)
      } else {
        setPersistError(true)
      }
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  const handleBack = () => {
    goBack()
    navigate('/room')
  }

  const handleHome = () => {
    goHome()
    navigate('/plan')
  }

  const total = computeTotal(selectedPlan!, selectedRoom!, selectedExtra, selectedDays, catalog)

  const roomPrice = selectedPlan === 'hospedaje'
    ? (catalog?.find(r => r.key === selectedRoom)?.price ?? 0)
    : selectedPlan === 'suite' && selectedExtra
    ? computeTotal('suite', selectedRoom!, selectedExtra, selectedDays, catalog)
    : (catalog?.find(r => r.key === selectedRoom)?.price ?? 0)

  return (
    <>
      {/* P1b layout: columna 100dvh con overflow oculto; progreso y cabecera
          shrink-0 siempre en viewport; el CTA inferior (tecla OK del teclado
          en zona fija de CheckinForm) nunca queda fuera de pantalla. */}
      <div className="h-full min-h-0 flex flex-col overflow-hidden" style={{ maxHeight: '100dvh' }}>
        <div className="shrink-0 px-4 pb-2 pt-1">
          <div className="h-[3px] bg-navy/10 rounded-full overflow-hidden">
            <div className={`h-full bg-[var(--hc-verde-800)] rounded-full ${prefersReduced ? '' : 'progress-fill'}`} style={{ width: '100%' }} />
          </div>
        </div>

        <div className="shrink-0 px-4 py-2 flex items-center gap-3">
          <button onClick={handleBack} className="tap-scale w-12 h-12 rounded-full bg-navy/8 flex items-center justify-center text-navy hover:bg-navy/15 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-display text-[length:var(--fs-body)] text-navy font-bold uppercase">
            Check-In
          </h2>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
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
      </div>

      {loading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/50">
          <div className={`bg-white rounded-2xl px-10 py-8 text-center shadow-2xl ${prefersReduced ? '' : 'animate-pop'}`}>
            <div className="relative w-16 h-16 mx-auto">
              <div className={`w-16 h-16 border-4 border-navy/10 border-t-gold rounded-full ${prefersReduced ? '' : 'animate-spin'}`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="mt-4 font-bold text-navy text-lg uppercase">Confirmando reserva…</p>
            <p className="mt-1 text-sm text-navy/40 font-semibold">Procesando en recepción</p>
            <div className="w-40 h-1 bg-navy/10 rounded-full overflow-hidden mx-auto mt-4">
              <div className="h-full bg-[var(--hc-verde-800)] rounded-full" style={prefersReduced ? { width: '100%' } : { animation: 'confirmProgress 2s ease-in-out infinite' }} />
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
          onClose={handleHome}
        />
      )}

      {offline && <OfflineModal onClose={handleHome} />}

      {persistError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/60 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl animate-pop">
            <h3 className="font-display text-[length:var(--fs-section)] text-navy font-bold mb-1 uppercase">
              No se pudo guardar
            </h3>
            <p className="text-[length:var(--fs-small)] text-slate mb-5 leading-relaxed">
              Sin conexión y el dispositivo no permitió guardar el pedido. Intente de nuevo o acérquese a recepción.
            </p>
            <button
              onClick={() => setPersistError(false)}
              className="tap-scale w-full bg-navy text-white rounded-lg py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
