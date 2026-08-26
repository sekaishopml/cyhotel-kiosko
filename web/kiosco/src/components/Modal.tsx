import { motion, AnimatePresence } from 'framer-motion'
import { modalPop } from '../lib/animations'

interface Props {
  open: boolean
  onClose: () => void
  orderId: string
  roomNumber: string
  checkIn: string
  checkOut: string
  amount: number
}

export default function Modal({ open, onClose, orderId, roomNumber, checkIn, checkOut, amount }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            {...modalPop}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-soft-lg"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-verde-500 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-serif text-[length:var(--fs-section)] text-verde-900 mb-1 font-bold">¡Reserva confirmada!</h3>
            <p className="text-[length:var(--fs-body)] text-verde-700/70 mb-6">Tu habitación está lista</p>
            <div className="bg-crema rounded-2xl p-4 text-left space-y-2 text-[length:var(--fs-body)]">
              <p><span className="font-bold text-verde-900">ID:</span> {orderId}</p>
              <p><span className="font-bold text-verde-900">Habitación:</span> {roomNumber}</p>
              <p><span className="font-bold text-verde-900">Check-in:</span> {checkIn}</p>
              <p><span className="font-bold text-verde-900">Check-out:</span> {checkOut}</p>
              <p><span className="font-bold text-verde-900">Total:</span> ${amount}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="mt-6 w-full bg-verde-900 text-white rounded-2xl py-3 font-extrabold text-[length:var(--fs-body)] hover:bg-verde-700 transition-colors"
            >
              Cerrar
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
