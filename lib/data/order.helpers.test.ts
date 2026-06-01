// lib/data/order.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { buildOrder } from './order.helpers'
import type { ProductWithVariants } from './types'

function prod(over: Partial<ProductWithVariants>): ProductWithVariants {
  return {
    id: 'p', code: 'C', name: 'X', category: '', description: '', imageUrl: null,
    priceCost: 0, priceWholesale: 50, priceRetail: 90, weightGrams: 0, countsForWholesale: true,
    active: true, sortOrder: 0, variants: [], ...over,
  }
}

const legging = prod({
  id: 'L', code: 'LEG-001', name: 'Legging', priceWholesale: 50, priceRetail: 90, priceCost: 20,
  countsForWholesale: true,
  variants: [{ id: 'v1', productId: 'L', size: 'M', color: 'Preto', stock: 5 }],
})
const meia = prod({
  id: 'S', code: 'MEIA-001', name: 'Meia', priceWholesale: 8, priceRetail: 12, priceCost: 3,
  countsForWholesale: false,
  variants: [{ id: 'v2', productId: 'S', size: 'U', color: 'Branco', stock: 9 }],
})

describe('buildOrder', () => {
  it('varejo abaixo do limite; snapshots corretos', () => {
    const r = buildOrder([legging], [{ productId: 'L', size: 'M', color: 'Preto', quantity: 2 }], 4)
    expect(r.priceType).toBe('retail')
    expect(r.total).toBe(180) // 2 * 90
    expect(r.items[0]).toMatchObject({
      product_id: 'L', variant_id: 'v1', product_code: 'LEG-001', size: 'M', color: 'Preto',
      quantity: 2, unit_price: 90, unit_cost: 20,
    })
  })

  it('atingiu o atacado: meia (não conta) também sai no atacado', () => {
    const r = buildOrder(
      [legging, meia],
      [{ productId: 'L', size: 'M', color: 'Preto', quantity: 4 }, { productId: 'S', size: 'U', color: 'Branco', quantity: 2 }],
      4,
    )
    expect(r.priceType).toBe('wholesale')
    expect(r.total).toBe(4 * 50 + 2 * 8) // 216
    const meiaItem = r.items.find((i) => i.product_code === 'MEIA-001')!
    expect(meiaItem.unit_price).toBe(8) // atacado
    expect(meiaItem.unit_cost).toBe(3)
  })

  it('variant_id null quando a combinação não existe', () => {
    const r = buildOrder([legging], [{ productId: 'L', size: 'GG', color: 'Rosa', quantity: 1 }], 4)
    expect(r.items[0].variant_id).toBeNull()
  })

  it('erro quando o produto não existe', () => {
    expect(() => buildOrder([], [{ productId: 'X', size: 'M', color: 'Preto', quantity: 1 }], 4)).toThrow()
  })
})
