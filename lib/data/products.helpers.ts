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

/** true quando o produto está efetivamente em promoção (flag ligada e preço > 0). */
export function isPromoActive(p: { onPromo: boolean; promoPrice: number }): boolean {
  return p.onPromo && p.promoPrice > 0
}

/**
 * Retorna nova lista com os produtos em promoção primeiro, preservando a ordem
 * original dentro de cada grupo (sort estável).
 */
export function sortPromoFirst<T extends { onPromo: boolean; promoPrice: number }>(produtos: T[]): T[] {
  const promo = produtos.filter(isPromoActive)
  const resto = produtos.filter((p) => !isPromoActive(p))
  return [...promo, ...resto]
}
