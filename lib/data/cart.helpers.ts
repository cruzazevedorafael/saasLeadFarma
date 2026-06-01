// lib/data/cart.helpers.ts
import type { CartItem } from '@/lib/store'

export type PriceType = 'retail' | 'wholesale'

/** Soma das quantidades apenas dos itens cujo produto conta para o atacado. */
export function countingQuantity(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + (i.product.countsForWholesale ? i.quantity : 0), 0)
}

/** O carrinho inteiro é atacado quando as peças que contam atingem o limite. */
export function cartPriceType(items: CartItem[], threshold: number): PriceType {
  return countingQuantity(items) >= threshold ? 'wholesale' : 'retail'
}

export function unitPriceFor(
  product: { priceWholesale: number; priceRetail: number },
  priceType: PriceType,
): number {
  return priceType === 'wholesale' ? product.priceWholesale : product.priceRetail
}

/** Total do carrinho aplicando o MESMO tipo de preço a todos os itens. */
export function cartTotal(items: CartItem[], priceType: PriceType): number {
  return items.reduce((acc, i) => acc + unitPriceFor(i.product, priceType) * i.quantity, 0)
}

/** Quantas peças que contam ainda faltam para virar atacado (0 se já atingiu). */
export function piecesUntilWholesale(items: CartItem[], threshold: number): number {
  return Math.max(0, threshold - countingQuantity(items))
}
