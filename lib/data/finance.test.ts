// lib/data/finance.test.ts
import { describe, it, expect } from 'vitest'
import { summarize } from './finance'

const o = (day: number, items: [number, number, number][]) => ({
  completedAt: `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`,
  items: items.map(([unitPrice, unitCost, quantity]) => ({ unitPrice, unitCost, quantity })),
})

describe('summarize', () => {
  it('soma receita, custo e lucro', () => {
    const r = summarize([o(3, [[90, 20, 2]]), o(10, [[50, 20, 4], [8, 3, 2]])])
    expect(r.revenue).toBe(2 * 90 + 4 * 50 + 2 * 8) // 396
    expect(r.cost).toBe(2 * 20 + 4 * 20 + 2 * 3) // 126
    expect(r.profit).toBe(396 - 126) // 270
  })

  it('mês vazio = tudo zero', () => {
    const r = summarize([])
    expect(r).toEqual({ revenue: 0, cost: 0, profit: 0, byDay: [] })
  })

  it('sem custo, lucro = vendas', () => {
    const r = summarize([o(5, [[90, 0, 1]])])
    expect(r.revenue).toBe(90)
    expect(r.profit).toBe(90)
  })

  it('agrupa vendas por dia', () => {
    const r = summarize([o(3, [[90, 20, 1]]), o(3, [[50, 20, 2]]), o(10, [[12, 3, 1]])])
    expect(r.byDay).toEqual([
      { day: 3, revenue: 90 + 100 },
      { day: 10, revenue: 12 },
    ])
  })
})
