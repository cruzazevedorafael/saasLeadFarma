// app/painel/settings-actions.ts
'use server'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { updatePharmacy } from '@/lib/data/pharmacy'
import { uploadImagem } from '@/lib/data/storage'
import { CATALOG_FONT_KEYS } from '@/lib/catalog-fonts.options'
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
  return uploadImagem(file, 'banner-')
}

export async function setLogo(url: string, accentColor: string | null) {
  const pharmacyId = await getCurrentPharmacyId()
  await updatePharmacy(pharmacyId, { logo_url: url || null, accent_color: accentColor || null })
  revalidatePath('/painel')
}

export async function uploadLogoImage(file: File): Promise<string> {
  await getCurrentPharmacyId()
  return uploadImagem(file, 'logo-')
}

// url vazia ('') remove o banner.
export async function setBannerImage(url: string) {
  const pharmacyId = await getCurrentPharmacyId()
  await updatePharmacy(pharmacyId, { banner_image_url: url })
  revalidatePath('/painel')
}

export async function setCatalogFont(key: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const val = CATALOG_FONT_KEYS.includes(key) && key !== 'padrao' ? key : null
  await updatePharmacy(pharmacyId, { catalog_font: val })
  revalidatePath('/painel')
}
