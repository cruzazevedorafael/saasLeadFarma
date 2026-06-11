// app/_actions/criar-pedido.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { criarPedido } from './criar-pedido'

// Estado mutável que controla o banco fake de cada teste.
let productRows: any[] = []
let variantRows: any[] = []
let productsError: any = null
let orderInsertError: any = null
let insertedOrders: any[] = []

function fakeDb() {
  return {
    from(table: string) {
      if (table === 'products') {
        return { select: () => ({ in: async () => ({ data: productRows, error: productsError }) }) }
      }
      if (table === 'product_variants') {
        return { select: () => ({ in: async () => ({ data: variantRows, error: null }) }) }
      }
      if (table === 'shipping_methods' || table === 'payment_methods') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      }
      if (table === 'orders') {
        return {
          insert: (row: any) => {
            insertedOrders.push(row)
            return { select: () => ({ single: async () => ({ data: { id: 'o1', number: 7 }, error: orderInsertError }) }) }
          },
          delete: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === 'order_items') {
        return { insert: async () => ({ error: null }) }
      }
      throw new Error(`tabela inesperada no teste: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))
vi.mock('@/lib/data/settings', () => ({
  getStoreSettings: async () => ({
    storeName: 'Karolla Fit', whatsappNumber: '', reservationMinutes: 10, wholesaleThreshold: 4, bannerImageUrl: '',
  }),
}))

const legging = {
  id: 'L', code: 'LEG-001', name: 'Legging', price_cost: 20, price_wholesale: 50, price_retail: 90,
  weight_grams: 250, counts_for_wholesale: true,
}
const variante = { id: 'v1', product_id: 'L', size: 'M', color: 'Preto', stock: 5 }

const pedido = (quantity: number) => ({
  customerName: 'Maria',
  customerPhone: '11988887777',
  items: [{ productId: 'L', size: 'M', color: 'Preto', quantity }],
})

beforeEach(() => {
  productRows = [legging]
  variantRows = [variante]
  productsError = null
  orderInsertError = null
  insertedOrders = []
})

describe('criarPedido', () => {
  it('sucesso: retorna ok true com o número do pedido e sem aviso de estoque', async () => {
    const r = await criarPedido(pedido(2))
    expect(r).toMatchObject({ ok: true, number: 7, priceType: 'retail', stockWarning: null })
  })

  it('estoque insuficiente: registra o pedido mesmo assim, com o aviso gravado e devolvido', async () => {
    const r = await criarPedido(pedido(9))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.number).toBe(7)
      expect(r.stockWarning).toContain('Estoque insuficiente')
      expect(r.stockWarning).toContain('Legging (M/Preto)')
    }
    expect(insertedOrders).toHaveLength(1)
    expect(insertedOrders[0].stock_warning).toContain('Estoque insuficiente')
  })

  it('produto que não existe mais: retorna ok false, sem lançar', async () => {
    productRows = []
    variantRows = []
    const r = await criarPedido(pedido(1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('não está mais no catálogo')
  })

  it('erro de banco: retorna ok false com mensagem amigável, sem lançar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    productsError = { message: 'boom' }
    const r = await criarPedido(pedido(1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Não foi possível registrar')
  })
})
