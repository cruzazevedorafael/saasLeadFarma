// app/painel/pagamento/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
}

export async function createPayment(name: string, percent: number, fixed: number) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').insert({
    name: nome,
    surcharge_percent: Math.max(0, percent || 0),
    surcharge_fixed: Math.max(0, fixed || 0),
  })
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}

export async function updatePayment(id: string, name: string, percent: number, fixed: number, active: boolean) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').update({
    name: nome,
    surcharge_percent: Math.max(0, percent || 0),
    surcharge_fixed: Math.max(0, fixed || 0),
    active,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}

export async function deletePayment(id: string) {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}
