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
      className={`tap-scale w-full flex items-center gap-3 rounded-2xl p-2.5 transition-all duration-200 ${
        selected
          ? 'bg-navy text-white shadow-[0_4px_20px_rgba(15,23,42,0.2)]'
          : 'bg-white text-navy card-shadow'
      }`}
    >
      <img
        src={imgUrl(room.photo)}
        alt={room.label}
        className="w-20 h-20 rounded-xl object-cover shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0 text-left">
        <h4 className="font-sans text-[length:var(--fs-room-name)] font-extrabold uppercase tracking-wide truncate leading-tight">
          {room.label}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[length:var(--fs-body)] font-extrabold ${selected ? 'text-gold' : 'text-navy'}`}>
            ${room.price}
          </span>
          <span className="text-[0.6rem] text-navy/40 font-semibold uppercase">/ 3h</span>
          {room.free && (
            <span className="text-[0.6rem] bg-sage text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
              Gratis
            </span>
          )}
        </div>
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
