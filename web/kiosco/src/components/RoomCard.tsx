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
      className={`tap-scale w-full flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 ${
        selected
          ? 'bg-navy text-white shadow-[0_4px_20px_rgba(15,23,42,0.2)]'
          : 'bg-white text-navy card-shadow'
      }`}
    >
      <img
        src={imgUrl(room.photo)}
        alt={room.label}
        className="w-36 h-36 rounded-xl object-cover shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0 text-left">
        <h4 className="font-sans text-[length:var(--fs-room-name)] font-extrabold uppercase tracking-wide truncate leading-tight">
          {room.label}
        </h4>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`text-[length:var(--fs-display)] font-extrabold leading-none ${selected ? 'text-gold' : 'text-navy'}`}>
            ${room.price}
          </span>
          <span className={`text-xs font-semibold uppercase ${selected ? 'text-white' : 'text-navy/40'}`}>
            /3h
          </span>
        </div>
        {room.free && (
          <span className="inline-block mt-2 text-[0.65rem] bg-sage text-white px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
            Gratis
          </span>
        )}
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
        selected ? 'border-gold bg-gold' : 'border-navy/15'
      }`}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  )
}
