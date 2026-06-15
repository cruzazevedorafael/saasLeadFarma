// lib/data/products.helpers.ts
import type { ProductWithVariants } from './types'

// Ordem canônica das letras. Tamanhos numéricos entram depois (crescente);
// qualquer outro valor vai pro fim, em ordem alfabética.
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'G1', 'G2', 'G3']

// Chave de ordenação em 3 níveis: [tier, número, texto].
// tier 0 = letra conhecida (ordena pelo índice), 1 = numérico, 2 = outro.
function sizeKey(size: string): [number, number, string] {
  const u = size.trim().toUpperCase()
  const known = SIZE_ORDER.indexOf(u)
  if (known !== -1) return [0, known, '']
  const n = Number(u)
  if (u !== '' && !Number.isNaN(n)) return [1, n, '']
  return [2, 0, u]
}

function compareSizes(a: string, b: string): number {
  const [ta, na, sa] = sizeKey(a)
  const [tb, nb, sb] = sizeKey(b)
  if (ta !== tb) return ta - tb
  if (na !== nb) return na - nb
  return sa.localeCompare(sb)
}

export function sizesOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.size))].sort(compareSizes)
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
