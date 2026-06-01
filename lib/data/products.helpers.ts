// lib/data/products.helpers.ts
import type { ProductWithVariants } from './types'

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
