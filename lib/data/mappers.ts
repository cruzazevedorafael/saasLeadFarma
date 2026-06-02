// lib/data/mappers.ts
import type { Product, ProductVariant } from './types'

export function mapVariantRow(r: any): ProductVariant {
  return { id: r.id, productId: r.product_id, size: r.size, color: r.color, stock: r.stock }
}

export function mapProductRow(r: any): Product {
  return {
    id: r.id,
    code: r.code ?? '',
    name: r.name,
    category: r.category ?? '',
    description: r.description ?? '',
    imageUrl: r.image_url ?? null,
    priceCost: Number(r.price_cost ?? 0),
    priceWholesale: Number(r.price_wholesale ?? 0),
    priceRetail: Number(r.price_retail ?? 0),
    weightGrams: Number(r.weight_grams ?? 0),
    countsForWholesale: r.counts_for_wholesale ?? true,
    active: r.active ?? true,
    sortOrder: Number(r.sort_order ?? 0),
  }
}
