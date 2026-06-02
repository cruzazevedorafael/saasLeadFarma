// app/painel/settings-actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function setWholesaleThreshold(value: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  const threshold = Math.max(1, Math.floor(Number(value) || 1))
  const db = createAdminClient()
  const { error } = await db.from('store_settings').update({ wholesale_threshold: threshold, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  revalidatePath('/painel')
  revalidatePath('/')
}

export async function setStoreContact(storeName: string, whatsappNumber: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  const db = createAdminClient()
  const { error } = await db
    .from('store_settings')
    .update({ store_name: storeName, whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
  revalidatePath('/painel')
  revalidatePath('/')
}

export async function uploadBannerImage(file: File): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  const db = createAdminClient()
  const { error } = await db
    .from('store_settings')
    .update({ banner_image_url: url, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
  revalidatePath('/painel')
  revalidatePath('/')
}
