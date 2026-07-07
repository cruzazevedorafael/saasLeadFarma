// app/painel/pagamento/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

export async function createPayment(name: string, percent: number, fixed: number) {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').insert({
    pharmacy_id: pharmacyId,
    name: nome,
    surcharge_percent: Math.max(0, percent || 0),
    surcharge_fixed: Math.max(0, fixed || 0),
  })
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}

export async function updatePayment(id: string, name: string, percent: number, fixed: number, active: boolean) {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').update({
    name: nome,
    surcharge_percent: Math.max(0, percent || 0),
    surcharge_fixed: Math.max(0, fixed || 0),
    active,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}

export async function deletePayment(id: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').delete().eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}
