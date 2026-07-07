// app/painel/pedidos/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

/** Confirma que o pedido pertence à farmácia logada antes de chamar RPCs que operam por order_id. */
async function assertOrderBelongsToPharmacy(db: ReturnType<typeof createAdminClient>, orderId: string, pharmacyId: string) {
  const { data: order, error } = await db
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle()
  if (error) throw error
  if (!order) throw new Error('Pedido não encontrado.')
}

export async function darBaixa(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  try {
    await assertOrderBelongsToPharmacy(db, orderId, pharmacyId)
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Pedido não encontrado.' }
  }
  const { error } = await db.rpc('complete_order', { p_order_id: orderId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  revalidatePath('/')
  return { ok: true }
}

export async function cancelarPedido(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  try {
    await assertOrderBelongsToPharmacy(db, orderId, pharmacyId)
  } catch (e: any) {
    return { ok: false, error: e.message ?? 'Pedido não encontrado.' }
  }
  // Devolve as peças ao estoque e marca como cancelado, atômico no banco.
  const { error } = await db.rpc('cancel_order', { p_order_id: orderId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  revalidatePath('/')
  return { ok: true }
}
