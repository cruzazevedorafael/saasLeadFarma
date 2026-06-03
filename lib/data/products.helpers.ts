// lib/data/products.helpers.ts
import type { ProductWithVariants } from './types'

export function sizesOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.size))]
}

export function colorsOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.color))]
}

export function stockOf(p: ProductWithVariants, size: string, color: string): number {
  const v = p.variants.find((x) => x.size === size && x.color === color)
  return v?.stock ?? 0
}

export function isVariantAvailable(p: ProductWithVariants, size: string, color: string): boolean {
  return stockOf(p, size, color) > 0
}

/** true quando vale mostrar botões de seleção; false → mostrar como texto fixo. */
export function shouldRenderAsButtons(values: string[]): boolean {
  return values.length >= 2
}
