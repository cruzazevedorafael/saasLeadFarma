// app/painel/settings-actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

export async function setWholesaleThreshold(value: number) {
  const pharmacyId = await getCurrentPharmacyId()
  const threshold = Math.max(1, Math.floor(Number(value) || 1))
  const db = createAdminClient()
  const { error } = await db
    .from('pharmacies')
    .update({ wholesale_threshold: threshold, updated_at: new Date().toISOString() })
    .eq('id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel')
}

export async function setStoreContact(storeName: string, whatsappNumber: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { error } = await db
    .from('pharmacies')
    .update({ nome_exibicao: storeName, whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
    .eq('id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel')
}

export async function uploadBannerImage(file: File): Promise<string> {
  await getCurrentPharmacyId()
  const db = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `banner-${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('produtos').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = db.storage.from('produtos').getPublicUrl(path)
  return data.publicUrl
}

// url vazia ('') remove o banner.
export async function setBannerImage(url: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { error } = await db
    .from('pharmacies')
    .update({ banner_image_url: url, updated_at: new Date().toISOString() })
    .eq('id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel')
}
