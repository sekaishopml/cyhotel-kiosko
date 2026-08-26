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
        className="animate-pop bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        <svg className="w-16 h-16 mx-auto mb-3" viewBox="0 0 52 52">
          <circle className="checkmark-circle" cx="26" cy="26" r="23" fill="none" stroke="#6B8F71" strokeWidth="2.5" />
          <path className="checkmark-check" fill="none" stroke="#6B8F71" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>

        <h3 className="font-display text-[length:var(--fs-section)] text-navy font-bold mb-0.5">
          ¡RESERVA CONFIRMADA!
        </h3>
        <p className="text-[length:var(--fs-small)] text-slate mb-4 uppercase font-semibold">
          Tu habitación está lista
        </p>

        <div className="bg-cream rounded-2xl p-4 text-left space-y-2">
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
          <div className="pt-2 border-t border-navy/10">
            <span className="font-bold text-navy text-[length:var(--fs-body)]">TOTAL: </span>
            <span className="font-extrabold text-gold text-[length:var(--fs-display)]">${amount}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="tap-scale mt-4 w-full bg-navy text-white rounded-2xl py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
