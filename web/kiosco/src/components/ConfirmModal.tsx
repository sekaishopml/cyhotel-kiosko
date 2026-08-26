interface Props {
  orderId: string
  roomNumber: string
  checkIn: string
  checkOut: string
  amount: number
  onClose: () => void
}

export default function ConfirmModal({ orderId, roomNumber, checkIn, checkOut, amount, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" onClick={onClose}>
      <div
        className="animate-pop bg-white rounded-3xl p-7 max-w-sm w-full text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-sage/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h3 className="font-display text-[length:var(--fs-section)] text-navy font-bold mb-1">
          ¡RESERVA CONFIRMADA!
        </h3>
        <p className="text-[length:var(--fs-body)] text-slate mb-5 uppercase font-semibold">
          Tu habitación está lista
        </p>

        <div className="bg-cream border-l-4 border-gold rounded-2xl p-4 text-left space-y-3">
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">ID:</span> {orderId}
          </p>
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">HABITACIÓN:</span> {roomNumber}
          </p>
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">CHECK-IN:</span> {checkIn}
          </p>
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">CHECK-OUT:</span> {checkOut}
          </p>
          <p className="text-[length:var(--fs-body)]">
            <span className="font-bold text-navy">TOTAL:</span>{' '}
            <span className="font-extrabold text-gold">${amount}</span>
          </p>
        </div>

        <button
          onClick={onClose}
          className="tap-scale mt-5 w-full bg-navy text-white rounded-2xl py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
