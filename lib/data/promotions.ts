// lib/data/promotions.ts — promoções da farmácia (até 10). Catálogo lê a view pública.
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export { MAX_PROMOTIONS } from './promotions.types'
export type { Promotion } from './promotions.types'
import type { Promotion } from './promotions.types'

/** Público (anon): promoções ativas da farmácia, ordenadas, pro carrossel do catálogo. */
export async function getPublicPromotions(pharmacyId: string): Promise<string[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('public_promotions')
    .select('image_url, sort_order')
    .eq('pharmacy_id', pharmacyId)
    .order('sort_order', { ascending: true })
  return (data ?? []).map((r: { image_url: string }) => r.image_url)
}

/** Painel (service_role, escopado): promoções da farmácia para gerenciar. */
export async function getPromotions(pharmacyId: string): Promise<Promotion[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('promotions')
    .select('id, image_url, sort_order, active')
    .eq('pharmacy_id', pharmacyId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (data ?? []).map((r: any) => ({ id: r.id, imageUrl: r.image_url, sortOrder: r.sort_order, active: r.active }))
}
