// app/painel/promotions-actions.ts — gerenciar promoções da farmácia (até 10).
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { uploadImagem } from '@/lib/data/storage'
import { MAX_PROMOTIONS } from '@/lib/data/promotions.types'
import { revalidatePath } from 'next/cache'

export async function uploadPromotionImage(file: File): Promise<string> {
  await getCurrentPharmacyId()
  return uploadImagem(file, 'promo-')
}

export async function addPromotion(url: string): Promise<{ ok: boolean; error?: string }> {
  const pharmacyId = await getCurrentPharmacyId()
  if (!url) return { ok: false, error: 'Imagem inválida.' }
  const db = createAdminClient()

  const { count } = await db.from('promotions').select('id', { count: 'exact', head: true }).eq('pharmacy_id', pharmacyId)
  if ((count ?? 0) >= MAX_PROMOTIONS) return { ok: false, error: `Limite de ${MAX_PROMOTIONS} promoções.` }

  const { data: last } = await db.from('promotions').select('sort_order').eq('pharmacy_id', pharmacyId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (last?.sort_order ?? -1) + 1

  const { error } = await db.from('promotions').insert({ pharmacy_id: pharmacyId, image_url: url, sort_order: nextOrder })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel')
  return { ok: true }
}

export async function removePromotion(id: string): Promise<void> {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  await db.from('promotions').delete().eq('id', id).eq('pharmacy_id', pharmacyId)
  revalidatePath('/painel')
}

/** Move a promoção para cima/baixo trocando o sort_order com o vizinho. */
export async function movePromotion(id: string, dir: 'up' | 'down'): Promise<void> {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { data: all } = await db.from('promotions').select('id, sort_order')
    .eq('pharmacy_id', pharmacyId).order('sort_order', { ascending: true })
  if (!all) return
  const i = all.findIndex((p) => p.id === id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= all.length) return
  const a = all[i], b = all[j]
  // troca os sort_order
  await db.from('promotions').update({ sort_order: b.sort_order }).eq('id', a.id).eq('pharmacy_id', pharmacyId)
  await db.from('promotions').update({ sort_order: a.sort_order }).eq('id', b.id).eq('pharmacy_id', pharmacyId)
  revalidatePath('/painel')
}
