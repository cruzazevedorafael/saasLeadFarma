// app/painel/produtos/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { produtoSchema, type ProdutoInput } from './_components/produto-schema'
import { revalidatePath } from 'next/cache'

export async function createProduto(input: ProdutoInput) {
  const pharmacyId = await getCurrentPharmacyId()
  const data = produtoSchema.parse(input)
  const db = createAdminClient()
  const { data: prod, error } = await db.from('products').insert({
    pharmacy_id: pharmacyId,
    code: data.code.trim() || null, name: data.name, category: data.category, description: data.description,
    price_wholesale: data.priceWholesale, price_retail: data.priceRetail,
    weight_grams: data.weightGrams,
    counts_for_wholesale: data.countsForWholesale, active: data.active,
    on_promo: data.onPromo, promo_price: data.onPromo ? data.promoPrice : null,
    image_url: data.imageUrls[0] ?? data.imageUrl ?? null,
    image_urls: data.imageUrls,
  }).select('id').single()
  if (error) throw error
  if (data.variants.length > 0) {
    const { error: vErr } = await db.from('product_variants').insert(
      data.variants.map((v) => ({ pharmacy_id: pharmacyId, product_id: prod.id, size: v.size, color: v.color, stock: v.stock }))
    )
    if (vErr) throw vErr
  }
  revalidatePath('/painel/produtos')
  revalidatePath('/')
  return prod.id as string
}

export async function updateProduto(id: string, input: ProdutoInput) {
  const pharmacyId = await getCurrentPharmacyId()
  const data = produtoSchema.parse(input)
  const db = createAdminClient()
  await db.from('products').update({
    code: data.code.trim() || null, name: data.name, category: data.category, description: data.description,
    price_wholesale: data.priceWholesale, price_retail: data.priceRetail,
    weight_grams: data.weightGrams,
    counts_for_wholesale: data.countsForWholesale, active: data.active,
    on_promo: data.onPromo, promo_price: data.onPromo ? data.promoPrice : null,
    image_url: data.imageUrls[0] ?? data.imageUrl ?? null,
    image_urls: data.imageUrls,
    updated_at: new Date().toISOString(),
  }).eq('id', id).eq('pharmacy_id', pharmacyId)
  await db.from('product_variants').delete().eq('product_id', id).eq('pharmacy_id', pharmacyId)
  if (data.variants.length > 0) {
    await db.from('product_variants').insert(
      data.variants.map((v) => ({ pharmacy_id: pharmacyId, product_id: id, size: v.size, color: v.color, stock: v.stock }))
    )
  }
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function setProdutoActive(id: string, active: boolean) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { error } = await db.from('products').update({ active }).eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function deleteProduto(id: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  await db.from('products').delete().eq('id', id).eq('pharmacy_id', pharmacyId) // variações caem por ON DELETE CASCADE
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function uploadProdutoImage(file: File): Promise<string> {
  await getCurrentPharmacyId()
  const db = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('produtos').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = db.storage.from('produtos').getPublicUrl(path)
  return data.publicUrl
}
