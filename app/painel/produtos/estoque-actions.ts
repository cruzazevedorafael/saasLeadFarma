// app/painel/produtos/estoque-actions.ts — estoque sem burocracia:
// adicionar produto rápido e ajustar/dar baixa de estoque direto na lista.
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

/** Cadastro rápido: só nome + preço (+ estoque opcional). Resto assume padrão. */
export async function quickAddProduto(name: string, priceRetail: number, stock: number): Promise<{ ok: boolean; error?: string }> {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = name.trim()
  const preco = Number(priceRetail)
  const est = Math.max(0, Math.floor(Number(stock) || 0))
  if (!nome) return { ok: false, error: 'Informe o nome.' }
  if (!(preco >= 0)) return { ok: false, error: 'Preço inválido.' }

  const db = createAdminClient()
  const { data: prod, error } = await db.from('products').insert({
    pharmacy_id: pharmacyId, name: nome, brand: '', requires_prescription: false,
    category: '', description: '', price_retail: preco, price_wholesale: preco,
    has_wholesale: false, weight_grams: 0, counts_for_wholesale: false,
    active: true, on_promo: false, promo_price: null, image_url: null, image_urls: [],
  }).select('id').single()
  if (error || !prod) return { ok: false, error: error?.message ?? 'Falha ao criar.' }

  if (est > 0) {
    await db.from('product_variants').insert({ pharmacy_id: pharmacyId, product_id: prod.id, size: '', color: '', stock: est })
  }
  revalidatePath('/painel/produtos')
  revalidatePath('/f/[slug]', 'page')
  return { ok: true }
}

/** Ajuste rápido de estoque (entrada/baixa). Opera na variante padrão do produto.
 *  0 variação → cria uma; 1 variação → ajusta; >1 → bloqueia (usar o editor). */
export async function setStockRapido(productId: string, value: number): Promise<{ ok: boolean; error?: string }> {
  const pharmacyId = await getCurrentPharmacyId()
  const est = Math.max(0, Math.floor(Number(value) || 0))
  const db = createAdminClient()

  const { data: variants } = await db.from('product_variants')
    .select('id').eq('product_id', productId).eq('pharmacy_id', pharmacyId)
  const n = variants?.length ?? 0

  if (n > 1) return { ok: false, error: 'Produto com variações — ajuste no editor.' }
  if (n === 0) {
    const { error } = await db.from('product_variants').insert({ pharmacy_id: pharmacyId, product_id: productId, size: '', color: '', stock: est })
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await db.from('product_variants').update({ stock: est }).eq('id', variants![0].id).eq('pharmacy_id', pharmacyId)
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/painel/produtos')
  revalidatePath('/f/[slug]', 'page')
  return { ok: true }
}
