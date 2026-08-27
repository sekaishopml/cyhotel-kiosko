interface Props {
  onClose: () => void
}

export default function OfflineModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" onClick={onClose}>
      <div
        className="animate-pop bg-white rounded-2xl p-7 max-w-sm w-full text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        <svg className="w-20 h-20 mx-auto mb-4" viewBox="0 0 52 52" fill="none">
          <circle cx="26" cy="26" r="23" stroke="#D97706" strokeWidth="2.5" />
          <path d="M26 14v14l8 5" stroke="#D97706" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h3 className="font-display text-[length:var(--fs-section)] text-navy font-bold mb-1 uppercase">
          Reserva Pendiente
        </h3>
        <p className="text-[length:var(--fs-small)] text-slate mb-5 leading-relaxed">
          No hay conexión con recepción. Se enviará automáticamente cuando vuelva la red.
        </p>

        <button
          onClick={onClose}
          className="tap-scale w-full bg-navy text-white rounded-lg py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Listo
        </button>
      </div>
    </div>
  )
}
