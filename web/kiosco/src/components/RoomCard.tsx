import { motion } from 'framer-motion'
import { fadeInUp, scaleOnTap } from '../lib/animations'
import { imgUrl } from '../api/client'

interface Props {
  name: string
  photo: string
  price: number
  free: boolean
  selected: boolean
  onClick: () => void
}

export default function RoomCard({ name, photo, price, free, selected, onClick }: Props) {
  return (
    <motion.button
      variants={fadeInUp}
      {...scaleOnTap}
      onClick={onClick}
      className={`flex h-[var(--room-h)] min-h-[var(--tap)] w-full rounded-2xl overflow-hidden border transition-colors ${
        selected
          ? 'bg-verde-900 border-verde-900 text-white shadow-soft'
          : 'bg-crema border-verde-900/10 text-ink hover:border-verde-600'
      }`}
    >
      <img
        src={imgUrl(photo)}
        alt={name}
        className="w-[var(--room-h)] h-full object-cover shrink-0"
      />
      <div className="flex-1 flex flex-col justify-center px-5 min-w-0">
        <h4 className="font-serif text-[length:var(--fs-room-name)] font-extrabold truncate">{name}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[length:var(--fs-body)] font-extrabold ${selected ? 'text-white' : 'text-verde-700'}`}>
            ${price}
          </span>
          {free && (
            <span className="text-[length:var(--fs-small)] bg-verde-500 text-white px-2 py-0.5 rounded-full font-bold">
              Gratis
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}
