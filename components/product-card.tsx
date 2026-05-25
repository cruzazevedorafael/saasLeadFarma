'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Product, useCartStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus, ShoppingBag, Check } from 'lucide-react'

interface ProductCardProps {
  product: Product
  index: number
}

export function ProductCard({ product, index }: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0])
  const [selectedColor, setSelectedColor] = useState(product.colors[0])
  const [quantity, setQuantity] = useState(1)
  const [priceType, setPriceType] = useState<'retail' | 'wholesale'>('retail')
  const [isAdded, setIsAdded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  const addItem = useCartStore((state) => state.addItem)

  const handleAddToCart = () => {
    addItem({
      product,
      quantity,
      size: selectedSize,
      color: selectedColor,
      priceType,
    })
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1500)
  }

  const currentPrice = priceType === 'wholesale' ? product.priceWholesale : product.priceRetail

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative overflow-hidden rounded-xl md:rounded-2xl border border-border/50 bg-card"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        {/* Category Badge */}
        <Badge 
          className="absolute top-2 left-2 md:top-3 md:left-3 bg-[#CFFF04] text-black font-medium hover:bg-[#CFFF04] text-[10px] md:text-xs px-2 py-0.5 md:px-2.5 md:py-1"
        >
          {product.category}
        </Badge>

        {/* Wholesale Badge */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 20 }}
          className="absolute top-2 right-2 md:top-3 md:right-3"
        >
          <Badge variant="secondary" className="bg-black/80 text-[#CFFF04] border border-[#CFFF04]/30 text-[9px] md:text-xs">
            Min. {product.minWholesale} pcs
          </Badge>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4 space-y-3 md:space-y-4">
        <div>
          <h3 className="font-semibold text-sm md:text-lg text-foreground leading-tight">
            {product.name}
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
            {product.description}
          </p>
        </div>

        {/* Price Toggle */}
        <div className="flex rounded-lg bg-muted/50 p-0.5 md:p-1">
          <button
            onClick={() => setPriceType('retail')}
            className={`flex-1 px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${
              priceType === 'retail'
                ? 'bg-[#CFFF04] text-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Varejo
          </button>
          <button
            onClick={() => setPriceType('wholesale')}
            className={`flex-1 px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${
              priceType === 'wholesale'
                ? 'bg-[#CFFF04] text-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Atacado
          </button>
        </div>

        {/* Price Display */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs text-muted-foreground">
              {priceType === 'wholesale' ? 'Preco Atacado' : 'Preco Varejo'}
            </span>
            <motion.span 
              key={currentPrice}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl md:text-2xl font-bold text-[#CFFF04]"
            >
              R$ {currentPrice.toFixed(2).replace('.', ',')}
            </motion.span>
          </div>
          {priceType === 'retail' && (
            <div className="text-right">
              <span className="text-[10px] md:text-xs text-muted-foreground block">No atacado</span>
              <span className="text-xs md:text-sm text-[#CFFF04]/70">
                R$ {product.priceWholesale.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>

        {/* Size Selection */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">Tamanho</span>
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`w-8 h-8 md:w-10 md:h-10 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  selectedSize === size
                    ? 'bg-[#CFFF04] text-black'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">Cor: {selectedColor}</span>
          <div className="flex gap-1.5 md:gap-2 flex-wrap">
            {product.colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all ${
                  selectedColor === color
                    ? 'bg-[#CFFF04] text-black'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] md:text-xs text-muted-foreground">Quantidade</span>
          <div className="flex items-center gap-2 md:gap-3 bg-muted rounded-lg p-0.5 md:p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors"
            >
              <Minus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
            <span className="w-6 md:w-8 text-center font-semibold text-sm md:text-base">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors"
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
          </div>
        </div>

        {/* Add to Cart Button */}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleAddToCart}
            className={`w-full h-10 md:h-12 text-sm md:text-base font-semibold transition-all ${
              isAdded 
                ? 'bg-green-500 hover:bg-green-500 text-white' 
                : 'bg-[#CFFF04] hover:bg-[#b8e600] text-black'
            }`}
          >
            <AnimatePresence mode="wait">
              {isAdded ? (
                <motion.div
                  key="added"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 md:gap-2"
                >
                  <Check className="h-4 w-4 md:h-5 md:w-5" />
                  Adicionado!
                </motion.div>
              ) : (
                <motion.div
                  key="add"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 md:gap-2"
                >
                  <ShoppingBag className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">Adicionar ao Carrinho</span>
                  <span className="sm:hidden">Adicionar</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>

        {/* Subtotal */}
        <div className="text-center pt-2 border-t border-border/50">
          <span className="text-xs md:text-sm text-muted-foreground">
            Subtotal: <span className="text-foreground font-semibold">
              R$ {(currentPrice * quantity).toFixed(2).replace('.', ',')}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  )
}
