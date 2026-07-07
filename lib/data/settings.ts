// lib/data/settings.ts
// Config da loja para o PAINEL. Deriva da farmácia corrente (o antigo
// store_settings singleton virou a tabela pharmacies).
import { getCurrentPharmacy } from '@/lib/auth/guards'

export interface StoreSettings {
  storeName: string
  whatsappNumber: string
  wholesaleThreshold: number
  bannerImageUrl: string
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const ph = await getCurrentPharmacy()
  return {
    storeName: ph.nomeExibicao,
    whatsappNumber: ph.whatsappNumber,
    wholesaleThreshold: ph.wholesaleThreshold,
    bannerImageUrl: ph.bannerImageUrl,
  }
}
