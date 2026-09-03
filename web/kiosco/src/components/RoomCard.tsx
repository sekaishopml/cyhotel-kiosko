import { useState, useEffect } from 'react'
import { RoomType } from '../types'
import { imgUrl } from '../api'
import { cn } from '../lib/cn'
import { tap } from '../lib/haptics'

interface Props {
  room: RoomType
  selected: boolean
  selectedPlan: string
  expanded: boolean
  onClick: () => void
  selectedExtra?: string | null
}

// P2 imágenes (§4 pwa-offline.md): variantes WebP servidas por el backend
// desde web/hotel-imagenes/*.webp (mismo origen /img/, sin cambiar backend:
// _serve_img ya mapea .webp). Dimensiones intrínsecas reales para reserva de
// layout; las clases Tailwind de tamaño visual no cambian.
function photoVariants(photo: string) {
  const dims = photo.toLowerCase().includes('suite')
    ? { w: 720, h: 1600, tw: 400, th: 889 }
    : { w: 899, h: 1599, tw: 400, th: 711 }
  const base = photo.replace(/\.(jpe?g)$/i, '')
  const isJpeg = base !== photo
  return {
    dims,
    isJpeg,
    webp: imgUrl(isJpeg ? `${base}.webp` : photo),
    thumbWebp: imgUrl(isJpeg ? `${base}-thumb.webp` : photo),
  }
}

export default function RoomCard({ room, selected, selectedPlan, expanded, onClick, selectedExtra }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = [room.photo]
  // Si la variante WebP falla (backend aún sin *.webp desplegados), se cae a
  // JPEG quitando el <source>; el <img> conserva su src original.
  const [webpOff, setWebpOff] = useState(false)
  useEffect(() => { setWebpOff(false) }, [room.photo])
  const variants = photoVariants(room.photo)

  useEffect(() => {
    if (!expanded || photos.length <= 1) return
    const id = setInterval(() => setPhotoIdx(i => (i + 1) % photos.length), 3500)
    return () => clearInterval(id)
  }, [expanded, photos.length])

  useEffect(() => {
    if (!expanded) setPhotoIdx(0)
  }, [expanded])

  const timeLabel = selectedPlan === 'suite'
    ? selectedExtra === 'amanecida' ? '18:00 - 09:00'
    : selectedExtra === 'hospedaje' ? 'por noche'
    : selectedExtra === 'momento' ? '/ 3h'
    : null
    : selectedPlan === 'amanecida'
    ? '18:00 - 09:00'
    : selectedPlan === 'hospedaje'
    ? null
    : '/ 3h'

  return (
    <button
      onPointerDown={() => tap()}
      onClick={onClick}
      className={cn('tap-scale w-full text-left rounded-lg transition-[background-color,box-shadow,padding] duration-300 room-card-inner',
        expanded
          ? 'bg-navy text-white p-3 shadow-[0_8px_30px_rgba(18,53,38,0.3)]'
          : selected
          ? 'bg-navy text-white p-3 shadow-[0_4px_20px_rgba(18,53,38,0.2)]'
          : 'bg-white text-navy p-3 card-shadow')}
    >
      <div className="flex items-center gap-3">
        <picture className="contents">
          {variants.isJpeg && !webpOff && <source srcSet={variants.thumbWebp} type="image/webp" />}
          <img
            src={imgUrl(room.photo)}
            alt={room.label}
            width={variants.dims.tw}
            height={variants.dims.th}
            className={cn('rounded-md object-cover shrink-0 transition-[width,height] duration-300 ease-out',
              expanded ? 'w-20 h-20' : 'w-14 h-14')}
            loading="lazy"
            decoding="async"
            onError={() => setWebpOff(true)}
          />
        </picture>
        <div className="flex-1 min-w-0">
          <h4 className="font-sans text-[length:var(--fs-room-name)] font-extrabold uppercase tracking-wide leading-tight">
            {room.label}
          </h4>
          {timeLabel && (
            <span className={cn('text-[0.6rem] font-semibold uppercase', expanded || selected ? 'text-white/60' : 'text-navy/35')}>
              {timeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-right font-extrabold leading-none', expanded || selected ? 'text-white' : 'text-[var(--hc-verde-800)]')}
            style={{ fontSize: 'var(--fs-display)' }}>
            ${room.price}
          </span>
          <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200',
            selected || expanded ? 'border-white bg-white' : 'border-navy/15')}>
            {(selected || expanded) && (
              <svg className="w-3 h-3 text-[var(--hc-verde-900)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-lg transition-[max-height,opacity] duration-500 ease-out"
        style={{
          maxHeight: expanded ? '180px' : '0px',
          opacity: expanded ? 1 : 0,
          contain: 'layout style paint',
        }}
      >
        <div className="relative w-full h-[160px] mt-3">
          {photos.map((photo, i) => (
            <picture key={i} className="contents">
              {variants.isJpeg && !webpOff && <source srcSet={variants.webp} type="image/webp" />}
              <img
                src={imgUrl(photo)}
                alt={room.label}
                width={variants.dims.w}
                height={variants.dims.h}
                className="absolute inset-0 w-full h-full object-cover rounded-lg transition-[opacity,transform] duration-500 ease-out"
                style={{
                  opacity: i === photoIdx ? 1 : 0,
                  transform: i === photoIdx ? 'scale(1)' : 'scale(1.05)',
                  willChange: 'opacity, transform',
                }}
                loading="lazy"
                decoding="async"
                onError={() => setWebpOff(true)}
              />
            </picture>
          ))}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {photos.map((_, i) => (
                <div
                  key={i}
                  className={cn('h-[5px] rounded-full transition-[width,background] duration-300',
                    i === photoIdx ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50')}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
