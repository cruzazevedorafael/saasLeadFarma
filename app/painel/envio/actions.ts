// app/painel/envio/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
}

export async function createShipping(name: string, price: number) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods').insert({ name: nome, price: Math.max(0, price || 0) })
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}

export async function updateShipping(id: string, name: string, price: number, active: boolean) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods')
    .update({ name: nome, price: Math.max(0, price || 0), active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}

export async function deleteShipping(id: string) {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}
