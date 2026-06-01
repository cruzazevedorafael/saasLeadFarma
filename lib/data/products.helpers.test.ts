// lib/data/products.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { sizesOf, colorsOf, isVariantAvailable } from './products.helpers'
import type { ProductWithVariants } from './types'

const p: ProductWithVariants = {
  id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  imageUrl: null, priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, weightGrams: 250,
  countsForWholesale: true, active: true, sortOrder: 0,
  variants: [
    { id: 'v1', productId: '1', size: 'M', color: 'Preto', stock: 3 },
    { id: 'v2', productId: '1', size: 'G', color: 'Preto', stock: 0 },
    { id: 'v3', productId: '1', size: 'M', color: 'Rosa', stock: 5 },
  ],
}

describe('sizesOf / colorsOf', () => {
  it('lista tamanhos distintos', () => {
    expect(sizesOf(p)).toEqual(['M', 'G'])
  })
  it('lista cores distintas', () => {
    expect(colorsOf(p)).toEqual(['Preto', 'Rosa'])
  })
})

describe('isVariantAvailable', () => {
  it('true quando há estoque', () => {
    expect(isVariantAvailable(p, 'M', 'Preto')).toBe(true)
  })
  it('false quando estoque 0', () => {
    expect(isVariantAvailable(p, 'G', 'Preto')).toBe(false)
  })
  it('false quando combinação não existe', () => {
    expect(isVariantAvailable(p, 'GG', 'Azul')).toBe(false)
  })
})
