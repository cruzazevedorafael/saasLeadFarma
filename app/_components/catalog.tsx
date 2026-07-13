// app/_components/catalog.tsx
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { CategoryFilter } from '@/components/category-filter'
import { ProductCard } from '@/components/product-card'
import { Cart } from '@/components/cart'
import { InstallButton } from '@/components/install-button'
import { Search } from 'lucide-react'
import type { ProductWithVariants } from '@/lib/data/types'
import type { ShippingMethod } from '@/lib/data/shipping'
import type { PaymentMethod } from '@/lib/data/payment'

// luminância simples pra decidir se o texto sobre a cor da marca é claro ou escuro
function textoSobre(cor: string): string {
  const h = cor.replace('#', '')
  if (h.length !== 6) return '#000'
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150 ? '#fff' : '#111'
}

function parseHex(cor: string): [number, number, number] {
  const h = cor.replace('#', '')
  if (h.length !== 6) return [249, 115, 22] // fallback laranja
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
// mistura a cor com branco (t=1 → branco) → tons claros derivados da marca
function tint([r, g, b]: [number, number, number], t: number): string {
  const m = (c: number) => Math.round(c + (255 - c) * t)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

// Tema do catálogo derivado da cor da logo (teoria das cores 60/30/10, SÓ no catálogo):
// 60% = superfícies bem claras tingidas da marca (fundo) + cards brancos;
// 30% = neutros tingidos (muted/bordas); 10% = a própria marca (acento/CTAs).
function catalogTheme(brand: string): React.CSSProperties {
  const rgb = parseHex(brand)
  return {
    ['--brand']: brand,
    ['--brand-fg']: textoSobre(brand),
    ['--background']: tint(rgb, 0.94),
    ['--card']: '#ffffff',
    ['--card-foreground']: 'oklch(0.22 0.02 60)',
    ['--foreground']: 'oklch(0.22 0.02 60)',
    ['--muted']: tint(rgb, 0.9),
    ['--muted-foreground']: 'oklch(0.5 0.03 60)',
    ['--secondary']: tint(rgb, 0.9),
    ['--accent']: tint(rgb, 0.86),
    ['--border']: tint(rgb, 0.82),
    ['--input']: tint(rgb, 0.82),
    ['--ring']: brand,
    ['--primary']: brand,
    ['--primary-foreground']: textoSobre(brand),
  } as React.CSSProperties
}

export function Catalog({ products, threshold, whatsappNumber, bannerImageUrl, promotions = [], shippingMethods, paymentMethods, pharmacyId, storeName, logoUrl, accentColor, fontFamily }: { products: ProductWithVariants[]; threshold: number; whatsappNumber: string; bannerImageUrl: string; promotions?: string[]; shippingMethods: ShippingMethod[]; paymentMethods: PaymentMethod[]; pharmacyId: string; storeName: string; logoUrl: string | null; accentColor?: string | null; fontFamily?: string | null }) {
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')
  const brand = accentColor || '#F97316'
  // tema (cores) + fonte white-label da farmácia, escopados no catálogo
  const brandVars = fontFamily
    ? { ...catalogTheme(brand), fontFamily, ['--font-display']: fontFamily } as React.CSSProperties
    : catalogTheme(brand)

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
    <main id="top" className="min-h-screen bg-background" style={brandVars}>
      <Header storeName={storeName} logoUrl={logoUrl} />
      <Hero bannerImageUrl={bannerImageUrl} promotions={promotions} storeName={storeName} logoUrl={logoUrl} />

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
                className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 rounded-full bg-muted border border-border/50 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 focus:border-[var(--brand)]/50 transition-all"
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
              <button onClick={() => setSelectedCategory('Todos')} className="text-xs md:text-sm text-[var(--brand)] hover:underline">
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
                className="mt-4 text-xs md:text-sm text-[var(--brand)] hover:underline"
              >
                Limpar filtros
              </button>
            </motion.div>
          )}
        </div>
      </section>

      <Cart threshold={threshold} whatsappNumber={whatsappNumber} shippingMethods={shippingMethods} paymentMethods={paymentMethods} pharmacyId={pharmacyId} storeName={storeName} />
      <InstallButton appName={storeName} />

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <span className="opacity-70">powered by</span>{' '}
        <span className="font-semibold text-[var(--brand)]">LeadFarma</span>
      </footer>
    </main>
  )
}
