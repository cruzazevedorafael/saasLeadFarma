// app/painel/produtos/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { produtoSchema, type ProdutoInput } from './_components/produto-schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
}

export async function createProduto(input: ProdutoInput) {
  await requireUser()
  const data = produtoSchema.parse(input)
  const db = createAdminClient()
  const { data: prod, error } = await db.from('products').insert({
    code: data.code, name: data.name, category: data.category, description: data.description,
    price_cost: data.priceCost, price_wholesale: data.priceWholesale, price_retail: data.priceRetail,
    weight_grams: data.weightGrams,
    counts_for_wholesale: data.countsForWholesale, active: data.active, image_url: data.imageUrl ?? null,
  }).select('id').single()
  if (error) throw error
  const { error: vErr } = await db.from('product_variants').insert(
    data.variants.map((v) => ({ product_id: prod.id, size: v.size, color: v.color, stock: v.stock }))
  )
  if (vErr) throw vErr
  revalidatePath('/painel/produtos')
  revalidatePath('/')
  return prod.id as string
}

export async function updateProduto(id: string, input: ProdutoInput) {
  await requireUser()
  const data = produtoSchema.parse(input)
  const db = createAdminClient()
  await db.from('products').update({
    code: data.code, name: data.name, category: data.category, description: data.description,
    price_cost: data.priceCost, price_wholesale: data.priceWholesale, price_retail: data.priceRetail,
    weight_grams: data.weightGrams,
    counts_for_wholesale: data.countsForWholesale, active: data.active, image_url: data.imageUrl ?? null, updated_at: new Date().toISOString(),
  }).eq('id', id)
  await db.from('product_variants').delete().eq('product_id', id)
  await db.from('product_variants').insert(
    data.variants.map((v) => ({ product_id: id, size: v.size, color: v.color, stock: v.stock }))
  )
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function setProdutoActive(id: string, active: boolean) {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.from('products').update({ active }).eq('id', id)
  if (error) throw error
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function deleteProduto(id: string) {
  await requireUser()
  const db = createAdminClient()
  await db.from('products').delete().eq('id', id) // variações caem por ON DELETE CASCADE
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function uploadProdutoImage(file: File): Promise<string> {
  await requireUser()
  const db = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('produtos').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = db.storage.from('produtos').getPublicUrl(path)
  return data.publicUrl
}
