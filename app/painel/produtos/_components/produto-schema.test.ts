// app/painel/produtos/_components/produto-schema.test.ts
import { describe, it, expect } from 'vitest'
import { produtoSchema } from './produto-schema'

const valido = {
  code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, countsForWholesale: true,
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
  it('rejeita código vazio', () => {
    expect(produtoSchema.safeParse({ ...valido, code: '' }).success).toBe(false)
  })
  it('rejeita sem variações', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [] }).success).toBe(false)
  })
  it('rejeita estoque negativo', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [{ size: 'M', color: 'Preto', stock: -1 }] }).success).toBe(false)
  })
  it('rejeita preço negativo', () => {
    expect(produtoSchema.safeParse({ ...valido, priceRetail: -5 }).success).toBe(false)
  })
})
