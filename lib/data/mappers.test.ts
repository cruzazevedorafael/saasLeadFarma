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
  it('mapeia campos, números e a flag de atacado', () => {
    const row = {
      id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
      image_url: null, price_cost: '20.00', price_wholesale: '49.90', price_retail: '89.90',
      counts_for_wholesale: true, active: true, sort_order: 0,
    }
    expect(mapProductRow(row)).toMatchObject({
      id: '1', code: 'LEG-001', priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9,
      countsForWholesale: true, imageUrl: null,
    })
  })

  it('countsForWholesale default true quando ausente', () => {
    expect(mapProductRow({ id: '2', code: 'X', name: 'Y' }).countsForWholesale).toBe(true)
  })

  it('mapeia image_urls quando presente', () => {
    expect(mapProductRow({ id: '3', code: 'A', name: 'B', image_urls: ['x.jpg', 'y.jpg'] }).imageUrls)
      .toEqual(['x.jpg', 'y.jpg'])
  })

  it('image_urls cai para [image_url] quando lista vazia', () => {
    expect(mapProductRow({ id: '4', code: 'A', name: 'B', image_url: 'capa.jpg', image_urls: [] }).imageUrls)
      .toEqual(['capa.jpg'])
  })

  it('image_urls vira [] quando não há nada', () => {
    expect(mapProductRow({ id: '5', code: 'A', name: 'B' }).imageUrls).toEqual([])
  })
})
