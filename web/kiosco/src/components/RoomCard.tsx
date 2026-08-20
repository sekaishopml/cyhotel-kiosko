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
      {...fadeInUp}
      {...scaleOnTap}
      onClick={onClick}
      className={`flex h-[112px] w-full rounded-2xl overflow-hidden border transition-colors ${
        selected
          ? 'bg-verde-900 border-verde-900 text-white'
          : 'bg-crema border-verde-900/10 text-ink hover:border-verde-600'
      }`}
    >
      <img
        src={imgUrl(photo)}
        alt={name}
        className="w-[112px] h-full object-cover shrink-0"
      />
      <div className="flex-1 flex flex-col justify-center px-4 min-w-0">
        <h4 className="font-serif text-xl font-semibold truncate">{name}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-lg font-bold ${selected ? 'text-white' : 'text-verde-700'}`}>
            ${price}
          </span>
          {free && (
            <span className="text-xs bg-verde-500 text-white px-2 py-0.5 rounded-full font-medium">
              Gratis
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}
