// components/product-images.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'

function ProductImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [currentSrc, setCurrentSrc] = useState(src)

  useEffect(() => {
    setCurrentSrc(src)
  }, [src])

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`absolute inset-0 h-full w-full ${className}`}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (currentSrc !== '/placeholder.svg') setCurrentSrc('/placeholder.svg')
      }}
    />
  )
}

export function ProductImages({ images, alt }: { images: string[]; alt: string }) {
  const list = images.length > 0 ? images : ['/placeholder.svg']
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [selected, setSelected] = useState(0)

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  useEffect(() => {
    if (!emblaApi || list.length < 2) return
    const id = setInterval(() => emblaApi.scrollNext(), 3500)
    return () => clearInterval(id)
  }, [emblaApi, list.length])

  if (list.length < 2) {
    return (
      <ProductImage
        src={list[0]}
        alt={alt}
        className="object-cover transition-transform duration-500 group-hover:scale-110"
      />
    )
  }

  return (
    <>
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {list.map((src, i) => (
            <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
              <ProductImage src={src} alt={alt} className="object-cover" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
        {list.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Foto ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === selected ? 'w-4 bg-[#F97316]' : 'w-1.5 bg-white/60'}`}
          />
        ))}
      </div>
    </>
  )
}
