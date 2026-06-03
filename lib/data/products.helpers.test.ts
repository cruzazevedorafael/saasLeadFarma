// lib/data/products.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { sizesOf, colorsOf, isVariantAvailable, stockOf } from './products.helpers'
import type { ProductWithVariants } from './types'

const p: ProductWithVariants = {
  id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  imageUrl: null, imageUrls: [], priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, weightGrams: 250,
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

describe('stockOf', () => {
  it('retorna o estoque da variação', () => {
    expect(stockOf(p, 'M', 'Preto')).toBe(3)
    expect(stockOf(p, 'M', 'Rosa')).toBe(5)
  })
  it('retorna 0 quando estoque zerado', () => {
    expect(stockOf(p, 'G', 'Preto')).toBe(0)
  })
  it('retorna 0 quando a combinação não existe', () => {
    expect(stockOf(p, 'GG', 'Azul')).toBe(0)
  })
})

import { shouldRenderAsButtons } from './products.helpers'

describe('shouldRenderAsButtons', () => {
  it('false com nenhuma opção', () => {
    expect(shouldRenderAsButtons([])).toBe(false)
  })
  it('false com uma opção (mostra como texto)', () => {
    expect(shouldRenderAsButtons(['Preto'])).toBe(false)
  })
  it('true com duas ou mais opções', () => {
    expect(shouldRenderAsButtons(['P', 'M'])).toBe(true)
  })
})
