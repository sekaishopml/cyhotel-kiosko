import { useState, useEffect } from 'react'
import { RoomType } from '../types'
import { imgUrl } from '../api'

interface Props {
  room: RoomType
  selected: boolean
  selectedPlan: string
  expanded: boolean
  onClick: () => void
}

export default function RoomCard({ room, selected, selectedPlan, expanded, onClick }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = [room.photo]

  useEffect(() => {
    if (!expanded || photos.length <= 1) return
    const id = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), 3000)
    return () => clearInterval(id)
  }, [expanded, photos.length])

  useEffect(() => {
    if (!expanded) setPhotoIdx(0)
  }, [expanded])

  const timeLabel = selectedPlan === 'amanecida'
    ? '18:00 - 09:00'
    : selectedPlan === 'hospedaje'
    ? null
    : '/ 3h'

  return (
    <button
      onClick={onClick}
      className={`tap-scale w-full text-left rounded-lg transition-all duration-400 room-card-inner ${
        expanded
          ? 'bg-navy text-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.3)]'
          : selected
          ? 'bg-navy text-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.2)]'
          : 'bg-white text-navy p-3 card-shadow'
      }`}
    >
      <div className="flex items-center gap-4">
        <img
          src={imgUrl(room.photo)}
          alt={room.label}
          className={`rounded-md object-cover shrink-0 transition-all duration-400 ${
            expanded ? 'w-24 h-24' : 'w-20 h-20'
          }`}
          loading="lazy"
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-sans text-[length:var(--fs-room-name)] font-extrabold uppercase tracking-wide leading-tight">
            {room.label}
          </h4>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-[length:var(--fs-display)] font-extrabold leading-none ${expanded || selected ? 'text-gold' : 'text-navy'}`}>
              ${room.price}
            </span>
            {timeLabel && (
              <span className={`text-[0.65rem] font-semibold uppercase ${expanded || selected ? 'text-white' : 'text-navy/40'}`}>
                {timeLabel}
              </span>
            )}
          </div>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
          selected || expanded ? 'border-gold bg-gold' : 'border-navy/15'
        }`}>
          {(selected || expanded) && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      <div className={`carousel-wrap ${expanded ? 'open' : ''}`}>
        {photos.map((photo, i) => (
          <img
            key={i}
            src={imgUrl(photo)}
            alt={room.label}
            className="carousel-img"
            style={{ opacity: i === photoIdx ? 1 : 0 }}
          />
        ))}
        {photos.length > 1 && (
          <div className="carousel-dots">
            {photos.map((_, i) => (
              <div key={i} className={`carousel-dot ${i === photoIdx ? 'active' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
