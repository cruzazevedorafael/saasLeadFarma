// app/_actions/reserva-carrinho.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'

// Reserva (ou ajusta) a quantidade de uma variação para um carrinho.
// Devolve quanto foi efetivamente reservado. Em falha de banco, devolve a
// quantidade pedida (best effort) pra não travar o cliente — o pedido final
// ainda valida o estoque.
export async function reservarItem(cartId: string, variantId: string, quantity: number): Promise<number> {
  if (!cartId || !variantId) return 0
  const db = createAdminClient()
  const { data, error } = await db.rpc('reservar_item', {
    p_cart_id: cartId, p_variant_id: variantId, p_quantity: quantity,
  })
  if (error) {
    console.error('[reservarItem] falha ao reservar:', error)
    return quantity
  }
  return Number(data ?? 0)
}

export async function liberarItem(cartId: string, variantId: string): Promise<void> {
  if (!cartId || !variantId) return
  const db = createAdminClient()
  await db.rpc('liberar_item', { p_cart_id: cartId, p_variant_id: variantId })
}

export async function liberarCarrinho(cartId: string): Promise<void> {
  if (!cartId) return
  const db = createAdminClient()
  await db.rpc('liberar_carrinho', { p_cart_id: cartId })
}
