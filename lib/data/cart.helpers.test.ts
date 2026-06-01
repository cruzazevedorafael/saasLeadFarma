// lib/data/cart.helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  countingQuantity, cartPriceType, unitPriceFor, cartTotal, piecesUntilWholesale,
} from './cart.helpers'
import type { CartItem } from '@/lib/store'
import type { Product } from './types'

function product(over: Partial<Product>): Product {
  return {
    id: 'p', code: 'C', name: 'X', category: '', description: '', imageUrl: null,
    priceCost: 0, priceWholesale: 50, priceRetail: 90, countsForWholesale: true,
    active: true, sortOrder: 0, ...over,
  }
}
const mk = (p: Product, quantity: number): CartItem => ({ product: p, quantity, size: 'M', color: 'Preto' })

const legging = product({ priceWholesale: 50, priceRetail: 90, countsForWholesale: true })
const meia = product({ id: 'm', priceWholesale: 8, priceRetail: 12, countsForWholesale: false })

describe('countingQuantity', () => {
  it('soma só as peças que contam', () => {
    expect(countingQuantity([mk(legging, 1), mk(meia, 3)])).toBe(1)
  })
})

describe('cartPriceType', () => {
  it('atacado quando atinge o limite (4 iguais contam)', () => {
    expect(cartPriceType([mk(legging, 4)], 4)).toBe('wholesale')
  })
  it('varejo abaixo do limite', () => {
    expect(cartPriceType([mk(legging, 3)], 4)).toBe('retail')
  })
  it('1 legging + 3 meias = varejo (meia não conta)', () => {
    expect(cartPriceType([mk(legging, 1), mk(meia, 3)], 4)).toBe('retail')
  })
  it('limite configurável', () => {
    expect(cartPriceType([mk(legging, 2)], 2)).toBe('wholesale')
  })
})

describe('cartTotal', () => {
  it('atingido o atacado, a meia também sai no atacado', () => {
    const items = [mk(legging, 4), mk(meia, 2)]
    const type = cartPriceType(items, 4) // 'wholesale'
    expect(cartTotal(items, type)).toBe(4 * 50 + 2 * 8) // 216
  })
  it('no varejo soma preços de varejo', () => {
    const items = [mk(legging, 1), mk(meia, 3)]
    const type = cartPriceType(items, 4) // 'retail'
    expect(cartTotal(items, type)).toBe(1 * 90 + 3 * 12) // 126
  })
})

describe('unitPriceFor', () => {
  it('escolhe o preço certo', () => {
    expect(unitPriceFor(legging, 'wholesale')).toBe(50)
    expect(unitPriceFor(legging, 'retail')).toBe(90)
  })
})

describe('piecesUntilWholesale', () => {
  it('quantas peças que contam faltam', () => {
    expect(piecesUntilWholesale([mk(legging, 1)], 4)).toBe(3)
  })
  it('zero quando já atingiu', () => {
    expect(piecesUntilWholesale([mk(legging, 4)], 4)).toBe(0)
  })
  it('meias não reduzem o que falta', () => {
    expect(piecesUntilWholesale([mk(legging, 1), mk(meia, 5)], 4)).toBe(3)
  })
})
