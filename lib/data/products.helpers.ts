import type { ProductWithVariants } from './types'

export function priceForQuantity(p: ProductWithVariants, qty: number): number {
  return qty >= p.minWholesale ? p.priceWholesale : p.priceRetail
}

export function sizesOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.size))]
}

export function colorsOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.color))]
}

export function isVariantAvailable(p: ProductWithVariants, size: string, color: string): boolean {
  const v = p.variants.find((x) => x.size === size && x.color === color)
  return !!v && v.stock > 0
}
