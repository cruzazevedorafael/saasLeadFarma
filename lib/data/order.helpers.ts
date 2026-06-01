// lib/data/order.helpers.ts
import { cartPriceType, unitPriceFor, cartTotal, type PriceType } from './cart.helpers'
import type { ProductWithVariants } from './types'

export interface RequestedItem {
  productId: string
  size: string
  color: string
  quantity: number
}

export interface OrderItemRow {
  product_id: string
  variant_id: string | null
  product_code: string
  product_name: string
  size: string
  color: string
  quantity: number
  unit_price: number
  unit_cost: number
}

export interface BuiltOrder {
  priceType: PriceType
  total: number
  items: OrderItemRow[]
}

export function buildOrder(
  products: ProductWithVariants[],
  requested: RequestedItem[],
  threshold: number,
): BuiltOrder {
  const byId = new Map(products.map((p) => [p.id, p]))
  const cartItems = requested.map((r) => {
    const p = byId.get(r.productId)
    if (!p) throw new Error(`Produto não encontrado: ${r.productId}`)
    return { product: p, quantity: r.quantity, size: r.size, color: r.color }
  })

  const priceType = cartPriceType(cartItems, threshold)
  const total = cartTotal(cartItems, priceType)

  const items: OrderItemRow[] = cartItems.map((ci) => {
    const p = ci.product
    const variant = p.variants.find((v) => v.size === ci.size && v.color === ci.color)
    return {
      product_id: p.id,
      variant_id: variant?.id ?? null,
      product_code: p.code,
      product_name: p.name,
      size: ci.size,
      color: ci.color,
      quantity: ci.quantity,
      unit_price: unitPriceFor(p, priceType),
      unit_cost: p.priceCost,
    }
  })

  return { priceType, total, items }
}
