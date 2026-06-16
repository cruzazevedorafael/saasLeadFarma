import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reservarItem, liberarItem, liberarCarrinho } from './reserva-carrinho'

let rpcCalls: { name: string; params: any }[] = []
let rpcData: any = 0
let rpcError: any = null

function fakeDb() {
  return {
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params })
      return { data: rpcData, error: rpcError }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))

beforeEach(() => {
  rpcCalls = []
  rpcData = 0
  rpcError = null
})

describe('reservarItem', () => {
  it('chama reservar_item e devolve quanto foi concedido', async () => {
    rpcData = 2
    const granted = await reservarItem('cart-1', 'var-1', 3)
    expect(granted).toBe(2)
    expect(rpcCalls).toEqual([{ name: 'reservar_item', params: { p_cart_id: 'cart-1', p_variant_id: 'var-1', p_quantity: 3 } }])
  })

  it('cartId ou variantId vazio: não chama o banco e devolve 0', async () => {
    const granted = await reservarItem('', 'var-1', 3)
    expect(granted).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('erro no banco: best effort, devolve a quantidade pedida (não trava o cliente)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rpcError = { message: 'boom' }
    const granted = await reservarItem('cart-1', 'var-1', 3)
    expect(granted).toBe(3)
  })
})

describe('liberarItem / liberarCarrinho', () => {
  it('liberarItem chama liberar_item', async () => {
    await liberarItem('cart-1', 'var-1')
    expect(rpcCalls).toEqual([{ name: 'liberar_item', params: { p_cart_id: 'cart-1', p_variant_id: 'var-1' } }])
  })
  it('liberarCarrinho chama liberar_carrinho', async () => {
    await liberarCarrinho('cart-1')
    expect(rpcCalls).toEqual([{ name: 'liberar_carrinho', params: { p_cart_id: 'cart-1' } }])
  })
  it('liberarCarrinho com cartId vazio não chama o banco', async () => {
    await liberarCarrinho('')
    expect(rpcCalls).toHaveLength(0)
  })
})
