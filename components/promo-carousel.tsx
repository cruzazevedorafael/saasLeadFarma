// components/promo-carousel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ProductCard } from '@/components/product-card'
import type { ProductWithVariants } from '@/lib/data/types'
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react'

export function PromoCarousel({ products, threshold }: { products: ProductWithVariants[]; threshold: number }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', containScroll: false })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const multiplos = products.length >= 2

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  // Auto-rotação só quando há mais de uma promoção.
  useEffect(() => {
    if (!emblaApi || !multiplos) return
    const id = setInterval(() => emblaApi.scrollNext(), 4000)
    return () => clearInterval(id)
  }, [emblaApi, multiplos])

  if (products.length === 0) return null

  return (
    <section className="container mx-auto px-3 md:px-4 pt-4 md:pt-8">
      <div className="mb-3 md:mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base md:text-2xl font-bold">
          <Flame className="h-5 w-5 md:h-6 md:w-6 text-red-500" />
          Promoções
        </h2>
        {multiplos && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Anterior"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              disabled={!canPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Próximo"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              disabled={!canNext}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3 md:gap-6">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="min-w-0 flex-[0_0_44%] sm:flex-[0_0_44%] lg:flex-[0_0_28%] xl:flex-[0_0_22%]"
            >
              <ProductCard product={product} index={index} threshold={threshold} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
