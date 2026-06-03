// app/painel/produtos/_components/produto-schema.test.ts
import { describe, it, expect } from 'vitest'
import { produtoSchema } from './produto-schema'

const valido = {
  code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  priceWholesale: 49.9, priceRetail: 89.9, countsForWholesale: true,
  active: true,
  variants: [{ size: 'M', color: 'Preto', stock: 3 }],
}

describe('produtoSchema', () => {
  it('aceita produto válido', () => {
    expect(produtoSchema.safeParse(valido).success).toBe(true)
  })
  it('countsForWholesale default true quando ausente', () => {
    const { countsForWholesale, ...semFlag } = valido
    const parsed = produtoSchema.parse(semFlag)
    expect(parsed.countsForWholesale).toBe(true)
  })
  it('aceita countsForWholesale false', () => {
    const parsed = produtoSchema.parse({ ...valido, countsForWholesale: false })
    expect(parsed.countsForWholesale).toBe(false)
  })
  it('aceita código vazio (opcional)', () => {
    expect(produtoSchema.safeParse({ ...valido, code: '' }).success).toBe(true)
  })
  it('aceita sem variações (opcional)', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [] }).success).toBe(true)
  })
  it('aceita variação sem tamanho e cor (opcionais)', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [{ size: '', color: '', stock: 0 }] }).success).toBe(true)
  })
  it('rejeita estoque negativo', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [{ size: 'M', color: 'Preto', stock: -1 }] }).success).toBe(false)
  })
  it('rejeita preço negativo', () => {
    expect(produtoSchema.safeParse({ ...valido, priceRetail: -5 }).success).toBe(false)
  })
  it('onPromo/promoPrice default: false e 0', () => {
    const parsed = produtoSchema.parse(valido)
    expect(parsed.onPromo).toBe(false)
    expect(parsed.promoPrice).toBe(0)
  })
  it('aceita promoção com preço promocional > 0', () => {
    expect(produtoSchema.safeParse({ ...valido, onPromo: true, promoPrice: 39.9 }).success).toBe(true)
  })
  it('rejeita promoção sem preço promocional', () => {
    expect(produtoSchema.safeParse({ ...valido, onPromo: true, promoPrice: 0 }).success).toBe(false)
  })
})
