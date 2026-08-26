interface Props {
  onClose: () => void
}

export default function OfflineModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" onClick={onClose}>
      <div
        className="animate-pop bg-white rounded-3xl p-7 max-w-sm w-full text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gold/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h3 className="font-display text-[length:var(--fs-section)] text-navy font-bold mb-1 uppercase">
          Reserva Guardada
        </h3>
        <p className="text-[length:var(--fs-small)] text-slate mb-5 leading-relaxed">
          No hay conexión con recepción. Se enviará automáticamente cuando vuelva la red.
        </p>

        <button
          onClick={onClose}
          className="tap-scale w-full bg-navy text-white rounded-2xl py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Listo
        </button>
      </div>
    </div>
  )
}
