// app/_components/catalog.tsx
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { CategoryFilter } from '@/components/category-filter'
import { ProductCard } from '@/components/product-card'
import { Cart } from '@/components/cart'
import { Search } from 'lucide-react'
import type { ProductWithVariants } from '@/lib/data/types'

export function Catalog({ products, threshold, whatsappNumber }: { products: ProductWithVariants[]; threshold: number; whatsappNumber: string }) {
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = useMemo(
    () => ['Todos', ...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  )

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />

      <section className="sticky top-14 md:top-20 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 py-3 md:py-4">
        <div className="container mx-auto px-3 md:px-4 space-y-3 md:space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md mx-auto"
          >
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 rounded-full bg-muted border border-border/50 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#CFFF04]/50 focus:border-[#CFFF04]/50 transition-all"
              />
            </div>
          </motion.div>

          <CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        </div>
      </section>

      <section className="py-4 md:py-12">
        <div className="container mx-auto px-3 md:px-4">
          <motion.div
            key={filteredProducts.length}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 md:mb-6 flex items-center justify-between"
          >
            <p className="text-xs md:text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{filteredProducts.length}</span>{' '}
              produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>
            {selectedCategory !== 'Todos' && (
              <button onClick={() => setSelectedCategory('Todos')} className="text-xs md:text-sm text-[#CFFF04] hover:underline">
                Ver todos
              </button>
            )}
          </motion.div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} threshold={threshold} />
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
              <div className="mb-4 rounded-full bg-muted p-4 md:p-6">
                <Search className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base md:text-lg font-semibold">Nenhum produto encontrado</h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Tente buscar por outro termo ou categoria</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('Todos') }}
                className="mt-4 text-xs md:text-sm text-[#CFFF04] hover:underline"
              >
                Limpar filtros
              </button>
            </motion.div>
          )}
        </div>
      </section>

      <Cart threshold={threshold} whatsappNumber={whatsappNumber} />
    </main>
  )
}
