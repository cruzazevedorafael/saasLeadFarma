// app/painel/settings-actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { updatePharmacy } from '@/lib/data/pharmacy'
import { revalidatePath } from 'next/cache'

export async function setWholesaleThreshold(value: number) {
  const pharmacyId = await getCurrentPharmacyId()
  const threshold = Math.max(1, Math.floor(Number(value) || 1))
  await updatePharmacy(pharmacyId, { wholesale_threshold: threshold })
  revalidatePath('/painel')
}

export async function setStoreContact(storeName: string, whatsappNumber: string) {
  const pharmacyId = await getCurrentPharmacyId()
  await updatePharmacy(pharmacyId, { nome_exibicao: storeName, whatsapp_number: whatsappNumber })
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
  await updatePharmacy(pharmacyId, { banner_image_url: url })
  revalidatePath('/painel')
}
