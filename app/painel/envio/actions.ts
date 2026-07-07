// app/painel/envio/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

export async function createShipping(name: string, price: number) {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods').insert({ pharmacy_id: pharmacyId, name: nome, price: Math.max(0, price || 0) })
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}

export async function updateShipping(id: string, name: string, price: number, active: boolean) {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods')
    .update({ name: nome, price: Math.max(0, price || 0), active, updated_at: new Date().toISOString() })
    .eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}

export async function deleteShipping(id: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods').delete().eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}
