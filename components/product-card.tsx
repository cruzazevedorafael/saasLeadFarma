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
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card"
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
          className="absolute top-3 left-3 bg-[#CFFF04] text-black font-medium hover:bg-[#CFFF04]"
        >
          {product.category}
        </Badge>

        {/* Wholesale Badge */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 20 }}
          className="absolute top-3 right-3"
        >
          <Badge variant="secondary" className="bg-black/80 text-[#CFFF04] border border-[#CFFF04]/30">
            Min. {product.minWholesale} pçs atacado
          </Badge>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground leading-tight">
            {product.name}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {product.description}
          </p>
        </div>

        {/* Price Toggle */}
        <div className="flex rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => setPriceType('retail')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
              priceType === 'retail'
                ? 'bg-[#CFFF04] text-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Varejo
          </button>
          <button
            onClick={() => setPriceType('wholesale')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
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
            <span className="text-xs text-muted-foreground">
              {priceType === 'wholesale' ? 'Preço Atacado' : 'Preço Varejo'}
            </span>
            <motion.span 
              key={currentPrice}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-[#CFFF04]"
            >
              R$ {currentPrice.toFixed(2).replace('.', ',')}
            </motion.span>
          </div>
          {priceType === 'retail' && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">No atacado</span>
              <span className="text-sm text-[#CFFF04]/70">
                R$ {product.priceWholesale.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
        </div>

        {/* Size Selection */}
        <div>
          <span className="text-xs text-muted-foreground mb-2 block">Tamanho</span>
          <div className="flex gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
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
          <span className="text-xs text-muted-foreground mb-2 block">Cor: {selectedColor}</span>
          <div className="flex gap-2 flex-wrap">
            {product.colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
          <span className="text-xs text-muted-foreground">Quantidade</span>
          <div className="flex items-center gap-3 bg-muted rounded-lg p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Add to Cart Button */}
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleAddToCart}
            className={`w-full h-12 text-base font-semibold transition-all ${
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
                  className="flex items-center gap-2"
                >
                  <Check className="h-5 w-5" />
                  Adicionado!
                </motion.div>
              ) : (
                <motion.div
                  key="add"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2"
                >
                  <ShoppingBag className="h-5 w-5" />
                  Adicionar ao Carrinho
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>

        {/* Subtotal */}
        <div className="text-center pt-2 border-t border-border/50">
          <span className="text-sm text-muted-foreground">
            Subtotal: <span className="text-foreground font-semibold">
              R$ {(currentPrice * quantity).toFixed(2).replace('.', ',')}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  )
}
