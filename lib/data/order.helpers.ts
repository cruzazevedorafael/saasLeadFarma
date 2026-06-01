// lib/data/order.helpers.ts
import { cartPriceType, unitPriceFor, cartTotal, type PriceType } from './cart.helpers'
import type { ProductWithVariants } from './types'

export interface RequestedItem {
  productId: string
  size: string
  color: string
  quantity: number
}

export interface ChosenShipping { label: string; price: number }
export interface ChosenPayment { label: string; percent: number; fixed: number }

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
  weight_grams: number
}

export interface BuiltOrder {
  priceType: PriceType
  itemsSubtotal: number
  shippingLabel: string
  shippingPrice: number
  paymentLabel: string
  paymentSurcharge: number
  total: number
  weightTotalGrams: number
  items: OrderItemRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildOrder(
  products: ProductWithVariants[],
  requested: RequestedItem[],
  threshold: number,
  shipping?: ChosenShipping,
  payment?: ChosenPayment,
): BuiltOrder {
  const byId = new Map(products.map((p) => [p.id, p]))
  const cartItems = requested.map((r) => {
    const p = byId.get(r.productId)
    if (!p) throw new Error(`Produto não encontrado: ${r.productId}`)
    return { product: p, quantity: r.quantity, size: r.size, color: r.color }
  })

  const priceType = cartPriceType(cartItems, threshold)
  const itemsSubtotal = round2(cartTotal(cartItems, priceType))

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
      weight_grams: p.weightGrams,
    }
  })

  const weightTotalGrams = items.reduce((acc, it) => acc + it.weight_grams * it.quantity, 0)

  const shippingLabel = shipping?.label ?? 'A combinar'
  const shippingPrice = round2(shipping?.price ?? 0)

  const base = itemsSubtotal + shippingPrice
  const paymentLabel = payment?.label ?? 'A combinar'
  const paymentSurcharge = payment
    ? round2(base * (payment.percent / 100) + payment.fixed)
    : 0

  const total = round2(itemsSubtotal + shippingPrice + paymentSurcharge)

  return {
    priceType,
    itemsSubtotal,
    shippingLabel,
    shippingPrice,
    paymentLabel,
    paymentSurcharge,
    total,
    weightTotalGrams,
    items,
  }
}
