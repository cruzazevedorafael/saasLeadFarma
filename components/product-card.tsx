// components/product-card.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/store'
import type { ProductWithVariants } from '@/lib/data/types'
import { sizesOf, colorsOf, isVariantAvailable, shouldRenderAsButtons, stockOf } from '@/lib/data/products.helpers'
import { ProductImages } from '@/components/product-images'
import { ProductDetail } from '@/components/product-detail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Minus, ShoppingBag, Check, Flame, FileText } from 'lucide-react'
import { reservarItem } from '@/app/_actions/reserva-carrinho'
import { addableFromGrant } from '@/lib/data/reserva.helpers'

interface ProductCardProps {
  product: ProductWithVariants
  index: number
  threshold: number
}

export function ProductCard({ product, index, threshold }: ProductCardProps) {
  const sizes = sizesOf(product)
  const colors = colorsOf(product)
  const [selectedSize, setSelectedSize] = useState(sizes[0] ?? '')
  const [selectedColor, setSelectedColor] = useState(colors[0] ?? '')
  const [quantity, setQuantity] = useState(1)
  const [isAdded, setIsAdded] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const addItem = useCartStore((state) => state.addItem)
  const available = isVariantAvailable(product, selectedSize, selectedColor)
  const stock = stockOf(product, selectedSize, selectedColor)
  const isPromo = product.onPromo && product.promoPrice > 0
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, stock)))
  }, [stock])

  const handleAddToCart = async () => {
    if (!available) return
    setAviso(null)
    const variant = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor)
    const store = useCartStore.getState()
    const cartId = store.ensureCartId()
    const jaNoCarrinho = store.items.find(
      (i) => i.product.id === product.id && i.size === selectedSize && i.color === selectedColor
    )?.quantity ?? 0
    const desejado = jaNoCarrinho + quantity

    // Reserva no servidor. Sem variant (catálogo antigo) não dá pra reservar:
    // segue o fluxo antigo e o pedido final cobre o estoque.
    const granted = variant ? await reservarItem(cartId, variant.id, desejado) : desejado
    const podeAdicionar = addableFromGrant(granted, jaNoCarrinho)
    if (podeAdicionar <= 0) {
      setAviso('Essa apresentação acabou de ser reservada. Tente outra dosagem/apresentação.')
      return
    }

    addItem({ product, quantity: podeAdicionar, size: selectedSize, color: selectedColor, variantId: variant?.id, maxStock: stock })
    if (granted < desejado) setAviso(`Só sobraram ${granted} no estoque.`)
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1500)
  }

  return (
    <>
    <ProductDetail product={product} threshold={threshold} open={detailOpen} onClose={() => setDetailOpen(false)} />
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-xl md:rounded-2xl border border-border/50 bg-card"
    >
      <div className="relative aspect-[4/5] overflow-hidden cursor-pointer" onClick={() => setDetailOpen(true)}>
        <ProductImages images={product.imageUrls} alt={product.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <Badge className="absolute top-2 left-2 md:top-3 md:left-3 bg-[var(--brand)] text-[var(--brand-fg)] font-medium hover:bg-[var(--brand)] text-[10px] md:text-xs px-2 py-0.5 md:px-2.5 md:py-1">
          {product.category}
        </Badge>
        {product.requiresPrescription && (
          <Badge variant="secondary" className="absolute top-2 right-2 md:top-3 md:right-3 bg-black/80 text-amber-300 border border-amber-300/30 text-[9px] md:text-xs flex items-center gap-1">
            <FileText className="h-2.5 w-2.5 md:h-3 md:w-3" /> Exige receita
          </Badge>
        )}
      </div>

      <div className="p-3 md:p-4 space-y-3 md:space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 onClick={() => setDetailOpen(true)} className="font-semibold text-sm md:text-lg text-foreground leading-tight cursor-pointer hover:text-[var(--brand)] transition-colors">{product.name}</h3>
          </div>
          {product.brand && <span className="text-[10px] md:text-xs font-medium text-[var(--brand)]">{product.brand}</span>}
          {product.code && <span className="block text-[10px] md:text-xs text-muted-foreground">Cód: {product.code}</span>}
          <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
          <button type="button" onClick={() => setDetailOpen(true)} className="text-[11px] md:text-xs font-medium text-[var(--brand)] hover:underline mt-1">
            Ver detalhes →
          </button>
        </div>

        {/* Preços (informativos — a regra acontece no carrinho) */}
        {isPromo ? (
          <div className="flex flex-col items-start gap-0.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-2.5 py-2 shadow-md shadow-red-600/30 md:flex-row md:items-center md:justify-between md:gap-2 md:px-4 md:py-3">
            <span className="flex items-center gap-1 text-white font-semibold text-[10px] md:text-sm uppercase tracking-wide leading-none">
              <Flame className="h-3.5 w-3.5 md:h-5 md:w-5 shrink-0" /> Promoção
            </span>
            <span className="text-lg md:text-2xl font-extrabold text-white whitespace-nowrap leading-tight">{fmt(product.promoPrice)}</span>
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] md:text-xs text-muted-foreground">Unitário</span>
              <span className="text-xl md:text-2xl font-bold text-foreground">{fmt(product.priceRetail)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] md:text-xs text-muted-foreground">A partir de {threshold} un.</span>
              <span className="text-lg md:text-xl font-bold text-[var(--brand)]">{fmt(product.priceWholesale)}</span>
            </div>
          </div>
        )}

        {/* Apresentação */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">Apresentação</span>
          {sizes.length > 0 ? (
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-8 h-8 px-2 md:min-w-10 md:h-10 md:px-3 rounded-lg text-xs md:text-sm font-medium transition-all ${
                    selectedSize === size ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-sm md:text-base font-medium text-foreground">—</span>
          )}
        </div>

        {/* Dosagem */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">
            Dosagem{!shouldRenderAsButtons(colors) ? `: ${colors[0] ?? '—'}` : `: ${selectedColor}`}
          </span>
          {shouldRenderAsButtons(colors) && (
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {colors.map((color) => {
                const colorOk = isVariantAvailable(product, selectedSize, color)
                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    disabled={!colorOk}
                    className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all ${
                      selectedColor === color ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    } ${!colorOk ? 'opacity-40 line-through cursor-not-allowed' : ''}`}
                  >
                    {color}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] md:text-xs text-muted-foreground">
            Quantidade
            {stock > 0 && stock <= 5 && (
              <span className="ml-1.5 text-amber-400">só restam {stock}</span>
            )}
          </span>
          <div className="flex items-center gap-2 md:gap-3 bg-muted rounded-lg p-0.5 md:p-1">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors">
              <Minus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
            <span className="w-6 md:w-8 text-center font-semibold text-sm md:text-base">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(stock, quantity + 1))}
              disabled={quantity >= stock}
              className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors disabled:opacity-40"
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleAddToCart}
            disabled={!available}
            className={`w-full h-10 md:h-12 text-sm md:text-base font-semibold transition-all ${
              isAdded ? 'bg-green-500 hover:bg-green-500 text-white' : 'bg-[var(--brand)] hover:opacity-90 text-[var(--brand-fg)]'
            } ${!available ? 'opacity-60' : ''}`}
          >
            <AnimatePresence mode="wait">
              {!available ? (
                <span>Esgotado</span>
              ) : isAdded ? (
                <motion.div key="added" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1.5 md:gap-2">
                  <Check className="h-4 w-4 md:h-5 md:w-5" /> Adicionado!
                </motion.div>
              ) : (
                <motion.div key="add" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1.5 md:gap-2">
                  <ShoppingBag className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">Adicionar ao Carrinho</span>
                  <span className="sm:hidden">Adicionar</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
        {aviso && <p className="text-xs text-amber-500 mt-2">{aviso}</p>}
      </div>
    </motion.div>
    </>
  )
}
