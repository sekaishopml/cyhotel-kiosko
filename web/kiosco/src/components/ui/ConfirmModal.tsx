import { useEffect, useState } from 'react'
import QRCodeSVG from 'react-qr-code'
import { getKioscoConfig } from '../../api'

interface Props {
  orderId: string
  roomNumber: string
  checkIn: string
  checkOut: string
  subtotal: number
  onClose: () => void
}

export default function ConfirmModal({ orderId, roomNumber, checkIn, checkOut, subtotal, onClose }: Props) {
  const [showQr, setShowQr] = useState(false)
  const [qrValue, setQrValue] = useState('')

  useEffect(() => {
    let cancelled = false
    getKioscoConfig().then(config => {
      if (cancelled) return
      const url = config.qr_url || (typeof location !== 'undefined' ? `${location.origin}/kiosco/` : '')
      setQrValue(url)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="animate-pop bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)] overflow-y-auto no-scrollbar max-h-full"
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
          <div className="pt-2 border-t border-navy/10 flex items-baseline gap-2">
            <span className="font-bold text-navy text-[length:var(--fs-body)]">TOTAL:</span>
            <span className="font-extrabold text-gold text-3xl">${subtotal}</span>
          </div>
        </div>

        <button
          onClick={() => setShowQr(s => !s)}
          className="tap-scale mt-4 w-full bg-gold/15 text-navy border-2 border-gold rounded-lg py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide transition-colors hover:bg-gold/25"
        >
          Código QR
        </button>

        {showQr && (
          <div className="mt-3 bg-white rounded-xl p-3 border border-gold/40 shadow-[0_4px_20px_rgba(212,175,116,0.25)] flex flex-col items-center gap-2">
            {qrValue ? (
              <QRCodeSVG value={qrValue} size={160} fgColor="#0F172A" bgColor="#FFFFFF" />
            ) : (
              <div className="w-[160px] h-[160px] flex items-center justify-center text-xs text-navy/40">Sin código</div>
            )}
            <p className="text-[0.6rem] font-bold text-navy/50 uppercase tracking-widest">Escanéa para más info</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="tap-scale mt-3 w-full bg-navy text-white rounded-lg py-3 font-extrabold text-[length:var(--fs-body)] uppercase tracking-wide hover:bg-navy/90 transition-colors shadow-[0_4px_20px_rgba(15,23,42,0.25)]"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
