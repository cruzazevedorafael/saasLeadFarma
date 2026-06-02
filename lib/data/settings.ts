// lib/data/settings.ts
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface StoreSettings {
  storeName: string
  whatsappNumber: string
  reservationMinutes: number
  wholesaleThreshold: number
  bannerImageUrl: string
}

const FALLBACK: StoreSettings = {
  storeName: 'Karolla Fit',
  whatsappNumber: '',
  reservationMinutes: 10,
  wholesaleThreshold: 4,
  bannerImageUrl: '',
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('store_name, whatsapp_number, reservation_minutes, wholesale_threshold, banner_image_url')
    .eq('id', 1)
    .single()
  if (error || !data) return FALLBACK
  return {
    storeName: data.store_name ?? FALLBACK.storeName,
    whatsappNumber: data.whatsapp_number ?? FALLBACK.whatsappNumber,
    reservationMinutes: Number(data.reservation_minutes ?? FALLBACK.reservationMinutes),
    wholesaleThreshold: Number(data.wholesale_threshold ?? FALLBACK.wholesaleThreshold),
    bannerImageUrl: data.banner_image_url ?? FALLBACK.bannerImageUrl,
  }
}
