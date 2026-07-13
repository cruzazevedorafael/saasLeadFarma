'use client'

import { useEffect, useState } from 'react'

// Carrossel leve das promoções do catálogo (auto-rotativo, com dots). Sem libs.
export function PromoCarousel({ images }: { images: string[] }) {
  const [i, setI] = useState(0)
  const n = images.length

  useEffect(() => {
    if (n <= 1) return
    const t = setInterval(() => setI((v) => (v + 1) % n), 4500)
    return () => clearInterval(t)
  }, [n])

  if (n === 0) return null

  return (
    <div className="w-full max-w-2xl px-1">
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-border/60">
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
          {images.map((src, idx) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={idx} src={src} alt={`Promoção ${idx + 1}`} className="block w-full shrink-0 object-cover" style={{ flex: '0 0 100%' }} />
          ))}
        </div>

        {n > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Ir para promoção ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
