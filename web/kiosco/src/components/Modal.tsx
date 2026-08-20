import { motion, AnimatePresence } from 'framer-motion'

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
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-verde-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-serif text-2xl text-verde-900 mb-1">¡Reserva confirmada!</h3>
            <p className="text-sm text-verde-700/60 mb-6">Tu habitación está lista</p>
            <div className="bg-crema rounded-2xl p-4 text-left space-y-2 text-sm">
              <p><span className="font-semibold text-verde-900">ID:</span> {orderId}</p>
              <p><span className="font-semibold text-verde-900">Habitación:</span> {roomNumber}</p>
              <p><span className="font-semibold text-verde-900">Check-in:</span> {checkIn}</p>
              <p><span className="font-semibold text-verde-900">Check-out:</span> {checkOut}</p>
              <p><span className="font-semibold text-verde-900">Total:</span> ${amount}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="mt-6 w-full bg-verde-900 text-white rounded-2xl py-3 font-semibold text-lg hover:bg-verde-700 transition-colors"
            >
              Cerrar
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
