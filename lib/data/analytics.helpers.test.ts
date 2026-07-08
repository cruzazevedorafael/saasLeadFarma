import { describe, it, expect } from 'vitest'
import { computeAnalytics, type AnalyticsOrder } from './analytics.helpers'

const mk = (over: Partial<AnalyticsOrder>): AnalyticsOrder => ({
  total: 100, status: 'completed', createdAt: '2026-07-08T14:00:00',
  items: [{ productId: 'p1', productName: 'Dipirona', quantity: 2, unitPrice: 10 }],
  ...over,
})

describe('computeAnalytics', () => {
  it('ticket médio e faturamento contam só concluídos', () => {
    const a = computeAnalytics([
      mk({ total: 100, status: 'completed' }),
      mk({ total: 200, status: 'completed' }),
      mk({ total: 999, status: 'pending' }),
      mk({ total: 999, status: 'cancelled' }),
    ])
    expect(a.faturamento).toBe(300)
    expect(a.concluidos).toBe(2)
    expect(a.ticketMedio).toBe(150)
    expect(a.cancelados).toBe(1)
    expect(a.totalPedidos).toBe(4)
  })

  it('mais vendidos soma quantidades e ignora cancelados', () => {
    const a = computeAnalytics([
      mk({ items: [{ productId: 'p1', productName: 'Dipirona', quantity: 3, unitPrice: 10 }] }),
      mk({ items: [{ productId: 'p2', productName: 'Vitamina C', quantity: 1, unitPrice: 20 }] }),
      mk({ status: 'cancelled', items: [{ productId: 'p1', productName: 'Dipirona', quantity: 50, unitPrice: 10 }] }),
    ])
    expect(a.topProdutos[0]).toEqual({ name: 'Dipirona', qtd: 3, receita: 30 })
    expect(a.itensVendidos).toBe(4)
  })

  it('agrupa por categoria usando o mapa produto→categoria', () => {
    const a = computeAnalytics(
      [mk({ items: [{ productId: 'p1', productName: 'Dipirona', quantity: 2, unitPrice: 10 }] })],
      { p1: 'Medicamentos' },
    )
    expect(a.porCategoria[0]).toEqual({ label: 'Medicamentos', pedidos: 2, receita: 20 })
  })

  it('sazonalidade: dia da semana e hora', () => {
    // 2026-07-08 é uma quarta-feira, 14h
    const a = computeAnalytics([mk({ createdAt: '2026-07-08T14:30:00' })])
    expect(a.porDiaSemana[3]).toMatchObject({ label: 'Quarta', pedidos: 1 })
    expect(a.porHora.find((h) => h.label === '14h')?.pedidos).toBe(1)
  })
})
