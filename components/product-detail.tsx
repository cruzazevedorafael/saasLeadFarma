'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText } from 'lucide-react'
import type { ProductWithVariants } from '@/lib/data/types'
import { ProductImages } from '@/components/product-images'

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

// Modal de detalhe do produto: fotos (mesmo carrossel do card, maior), marca,
// descrição, apresentações/dosagens e preços. O carrossel do card continua igual.
export function ProductDetail({
  product, threshold, open, onClose,
}: {
  product: ProductWithVariants
  threshold: number
  open: boolean
  onClose: () => void
}) {
  const isPromo = product.onPromo && product.promoPrice > 0
  const presentations = product.variants

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4"
          >
            <div className="max-h-[90vh] w-full sm:max-w-lg overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-2xl">
              <div className="flex items-center justify-between p-3 md:p-4 border-b border-border sticky top-0 bg-background z-10">
                <h2 className="font-semibold truncate pr-2">{product.name}</h2>
                <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted shrink-0"><X className="h-5 w-5" /></button>
              </div>

              <div className="relative aspect-square bg-muted">
                <ProductImages images={product.imageUrls} alt={product.name} />
                {product.requiresPrescription && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/80 text-amber-300 text-xs px-2 py-1">
                    <FileText className="h-3 w-3" /> Exige receita
                  </span>
                )}
              </div>

              <div className="p-4 space-y-4">
                <div>
                  {product.brand && <p className="text-sm font-medium text-[var(--brand)]">{product.brand}</p>}
                  {product.code && <p className="text-xs text-muted-foreground">Cód: {product.code}</p>}
                  {product.description && <p className="text-sm text-muted-foreground mt-1">{product.description}</p>}
                </div>

                {/* Preços */}
                {isPromo ? (
                  <div className="rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-3 text-white flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase">Promoção</span>
                    <span className="text-2xl font-extrabold">{fmt(product.promoPrice)}</span>
                  </div>
                ) : (
                  <div className="flex items-end justify-between rounded-xl bg-muted/40 px-4 py-3">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Unitário</span>
                      <span className="text-2xl font-bold">{fmt(product.priceRetail)}</span>
                    </div>
                    {product.hasWholesale && (
                      <div className="text-right">
                        <span className="block text-[10px] text-muted-foreground">A partir de {threshold} un.</span>
                        <span className="text-xl font-bold text-[var(--brand)]">{fmt(product.priceWholesale)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Apresentações / dosagens */}
                {presentations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Apresentações</h3>
                    <div className="space-y-1.5">
                      {presentations.map((v) => (
                        <div key={v.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                          <span>{[v.size, v.color].filter(Boolean).join(' · ') || 'Padrão'}</span>
                          <span className={v.stock > 0 ? 'text-muted-foreground' : 'text-red-500'}>
                            {v.stock > 0 ? `${v.stock} em estoque` : 'esgotado'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground pt-1">
                  Feche para escolher a apresentação e adicionar ao carrinho.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
