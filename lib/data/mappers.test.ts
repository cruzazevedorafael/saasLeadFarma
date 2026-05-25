// lib/data/mappers.test.ts
import { describe, it, expect } from 'vitest'
import { mapProductRow, mapVariantRow } from './mappers'

describe('mapVariantRow', () => {
  it('mapeia campos', () => {
    expect(mapVariantRow({ id: 'v1', product_id: '1', size: 'M', color: 'Preto', stock: 3 }))
      .toEqual({ id: 'v1', productId: '1', size: 'M', color: 'Preto', stock: 3 })
  })
})

describe('mapProductRow', () => {
  it('mapeia campos e números', () => {
    const row = {
      id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
      image_url: null, price_cost: '20.00', price_wholesale: '49.90', price_retail: '89.90',
      min_wholesale: 6, active: true, sort_order: 0,
    }
    expect(mapProductRow(row)).toMatchObject({
      id: '1', code: 'LEG-001', priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9,
      minWholesale: 6, imageUrl: null,
    })
  })
})
