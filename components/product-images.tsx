// components/product-images.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'

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
      <Image
        src={list[0]}
        alt={alt}
        fill
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
              <Image src={src} alt={alt} fill className="object-cover" />
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
            className={`h-1.5 rounded-full transition-all ${i === selected ? 'w-4 bg-[#CFFF04]' : 'w-1.5 bg-white/60'}`}
          />
        ))}
      </div>
    </>
  )
}
