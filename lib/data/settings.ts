// lib/data/settings.ts
// Config da loja para o PAINEL. Deriva da farmácia corrente (o antigo
// store_settings singleton virou a tabela pharmacies).
import { getCurrentPharmacy } from '@/lib/auth/guards'

export interface StoreSettings {
  storeName: string
  whatsappNumber: string
  wholesaleThreshold: number
  bannerImageUrl: string
  logoUrl: string | null
  accentColor: string | null
  catalogFont: string | null
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const ph = await getCurrentPharmacy()
  return {
    storeName: ph.nomeExibicao,
    whatsappNumber: ph.whatsappNumber,
    wholesaleThreshold: ph.wholesaleThreshold,
    bannerImageUrl: ph.bannerImageUrl,
    logoUrl: ph.logoUrl,
    accentColor: ph.accentColor,
    catalogFont: ph.catalogFont,
  }
}
