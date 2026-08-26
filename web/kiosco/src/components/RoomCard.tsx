import { useState, useEffect, useCallback } from 'react'
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
  const hasMultiplePhotos = photos.length > 1

  useEffect(() => {
    if (!expanded || !hasMultiplePhotos) return
    const id = setInterval(() => {
      setPhotoIdx(i => (i + 1) % photos.length)
    }, 3000)
    return () => clearInterval(id)
  }, [expanded, hasMultiplePhotos, photos.length])

  useEffect(() => {
    if (!expanded) setPhotoIdx(0)
  }, [expanded])

  const timeLabel = selectedPlan === 'amanecida'
    ? '19:00 - 09:00'
    : selectedPlan === 'hospedaje'
    ? null
    : '/ 3h'

  const stateClass = expanded
    ? 'room-card-expanded'
    : selected
    ? 'room-card-compact'
    : 'room-card-shrunk'

  if (expanded) {
    return (
      <button
        onClick={onClick}
        className={`tap-scale w-full rounded-2xl transition-all duration-400 bg-navy text-white shadow-[0_8px_30px_rgba(15,23,42,0.3)]`}
      >
        <div className="flex items-center gap-3 p-3 pb-0">
          <div className="flex-1 min-w-0 text-left">
            <h4 className="font-sans text-[length:var(--fs-room-name)] font-extrabold uppercase tracking-wide leading-tight">
              {room.label}
            </h4>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[length:var(--fs-display)] font-extrabold leading-none text-gold">
                ${room.price}
              </span>
              {timeLabel && (
                <span className="text-[0.65rem] font-semibold uppercase text-white">
                  {timeLabel}
                </span>
              )}
            </div>
          </div>
          <div className="w-5 h-5 rounded-full border-2 border-gold bg-gold flex items-center justify-center shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div className="px-3 pt-3">
          <div className="carousel-container">
            {photos.map((photo, i) => (
              <img
                key={i}
                src={imgUrl(photo)}
                alt={room.label}
                className="carousel-img"
                style={{ opacity: i === photoIdx ? 1 : 0 }}
              />
            ))}
            {hasMultiplePhotos && (
              <div className="carousel-dots">
                {photos.map((_, i) => (
                  <div key={i} className={`carousel-dot ${i === photoIdx ? 'active' : ''}`} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-3 py-3 text-left">
          <p className="text-[0.75rem] text-white/70 leading-relaxed">
            {room.desc}
          </p>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`tap-scale w-full flex items-center gap-4 rounded-2xl p-3 transition-all duration-400 ${
        selected
          ? 'bg-navy text-white shadow-[0_4px_20px_rgba(15,23,42,0.2)]'
          : 'bg-white text-navy card-shadow opacity-60 scale-[0.97]'
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
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-[length:var(--fs-display)] font-extrabold leading-none ${selected ? 'text-gold' : 'text-navy'}`}>
            ${room.price}
          </span>
          {timeLabel && (
            <span className={`text-[0.65rem] font-semibold uppercase ${selected ? 'text-white' : 'text-navy/40'}`}>
              {timeLabel}
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
