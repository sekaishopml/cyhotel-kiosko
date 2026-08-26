import { RoomType } from '../types'
import { imgUrl } from '../api'

interface Props {
  room: RoomType
  selected: boolean
  onClick: () => void
}

export default function RoomCard({ room, selected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`tap-scale flex h-[var(--room-h)] min-h-[var(--tap)] w-full rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
        selected
          ? 'bg-navy border-gold text-white ring-2 ring-gold/30'
          : 'bg-white border-gold/12 text-navy hover:border-gold/30 card-shadow'
      }`}
    >
      <img
        src={imgUrl(room.photo)}
        alt={room.label}
        className="w-[var(--room-h)] h-full object-cover shrink-0"
        loading="lazy"
      />
      <div className="flex-1 flex flex-col justify-center px-4 min-w-0">
        <h4 className="font-sans text-[length:var(--fs-room-name)] font-extrabold uppercase tracking-wide truncate leading-tight">
          {room.label}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[length:var(--fs-body)] font-extrabold ${selected ? 'text-gold' : 'text-navy'}`}>
            ${room.price}
          </span>
          {room.free && (
            <span className="text-[length:0.65rem] bg-sage text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
              Gratis
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
