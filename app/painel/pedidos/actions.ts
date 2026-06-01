// app/painel/pedidos/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
}

export async function darBaixa(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.rpc('complete_order', { p_order_id: orderId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  revalidatePath('/painel/financeiro')
  revalidatePath('/')
  return { ok: true }
}

export async function cancelarPedido(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db
    .from('orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', orderId)
    .neq('status', 'completed')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  return { ok: true }
}
