// lib/data/products.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { sizesOf, colorsOf, isVariantAvailable, stockOf } from './products.helpers'
import type { ProductWithVariants } from './types'

const p: ProductWithVariants = {
  id: '1', code: 'LEG-001', name: 'Legging', brand: '', requiresPrescription: false, category: 'Leggings', description: '',
  imageUrl: null, imageUrls: [], priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, hasWholesale: true, weightGrams: 250,
  countsForWholesale: true, onPromo: false, promoPrice: 0, active: true, sortOrder: 0,
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

  it('ordena os tamanhos por P, M, G, GG mesmo vindo embaralhado', () => {
    const prod: ProductWithVariants = {
      ...p,
      variants: [
        { id: 'a', productId: '1', size: 'GG', color: 'Preto', stock: 1 },
        { id: 'b', productId: '1', size: 'P', color: 'Preto', stock: 1 },
        { id: 'c', productId: '1', size: 'G', color: 'Preto', stock: 1 },
        { id: 'd', productId: '1', size: 'M', color: 'Preto', stock: 1 },
      ],
    }
    expect(sizesOf(prod)).toEqual(['P', 'M', 'G', 'GG'])
  })

  it('tamanhos numéricos em ordem crescente, depois das letras', () => {
    const prod: ProductWithVariants = {
      ...p,
      variants: [
        { id: 'a', productId: '1', size: '40', color: 'Preto', stock: 1 },
        { id: 'b', productId: '1', size: 'M', color: 'Preto', stock: 1 },
        { id: 'c', productId: '1', size: '38', color: 'Preto', stock: 1 },
      ],
    }
    expect(sizesOf(prod)).toEqual(['M', '38', '40'])
  })

  it('tamanho desconhecido vai pro fim', () => {
    const prod: ProductWithVariants = {
      ...p,
      variants: [
        { id: 'a', productId: '1', size: 'Único', color: 'Preto', stock: 1 },
        { id: 'b', productId: '1', size: 'G', color: 'Preto', stock: 1 },
      ],
    }
    expect(sizesOf(prod)).toEqual(['G', 'Único'])
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

import { shouldRenderAsButtons, isPromoActive, sortPromoFirst } from './products.helpers'

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

describe('isPromoActive', () => {
  it('true quando onPromo e preço > 0', () => {
    expect(isPromoActive({ onPromo: true, promoPrice: 39.9 })).toBe(true)
  })
  it('false quando onPromo mas preço 0', () => {
    expect(isPromoActive({ onPromo: true, promoPrice: 0 })).toBe(false)
  })
  it('false quando não está em promoção', () => {
    expect(isPromoActive({ onPromo: false, promoPrice: 39.9 })).toBe(false)
  })
})

describe('sortPromoFirst', () => {
  const a = { id: 'a', onPromo: false, promoPrice: 0 }
  const b = { id: 'b', onPromo: true, promoPrice: 50 }
  const c = { id: 'c', onPromo: false, promoPrice: 0 }
  const d = { id: 'd', onPromo: true, promoPrice: 30 }

  it('coloca as promoções primeiro', () => {
    expect(sortPromoFirst([a, b, c, d]).map((p) => p.id)).toEqual(['b', 'd', 'a', 'c'])
  })
  it('mantém a ordem estável dentro de cada grupo', () => {
    expect(sortPromoFirst([a, c, b]).map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })
  it('lista sem promoção fica inalterada', () => {
    expect(sortPromoFirst([a, c]).map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('promoção ligada sem preço não sobe', () => {
    const semPreco = { id: 'x', onPromo: true, promoPrice: 0 }
    expect(sortPromoFirst([a, semPreco, b]).map((p) => p.id)).toEqual(['b', 'a', 'x'])
  })
})
