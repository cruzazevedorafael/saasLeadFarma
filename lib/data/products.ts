// lib/data/products.ts
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapProductRow, mapVariantRow } from './mappers'
import type { ProductWithVariants } from './types'

// PÚBLICO: produtos ativos + variações (via tabelas base; RLS/anon liberado p/ select de produtos? ver nota)
// Nesta fase, leitura pública usa o cliente server (anon) lendo as VIEWS public_*.
export async function getPublicProducts(): Promise<ProductWithVariants[]> {
  const supabase = await createServerClient()
  const { data: products, error } = await supabase
    .from('public_products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error

  const ids = products.map((p) => p.id)
  const { data: variants, error: vErr } = await supabase
    .from('public_product_variants')
    .select('*')
    .in('product_id', ids)
  if (vErr) throw vErr

  return products.map((p) => ({
    ...mapProductRow({ ...p, price_cost: 0, active: true }),
    variants: variants
      .filter((v) => v.product_id === p.id)
      // a view pública expõe `available`; convertendo p/ stock binário (1/0) nesta fase
      .map((v) => mapVariantRow({ ...v, stock: v.available ? 1 : 0 })),
  }))
}

// PAINEL (admin): produtos completos com custo e estoque exato. Usa service-role no server.
export async function getAdminProducts(): Promise<ProductWithVariants[]> {
  const supabase = createAdminClient()
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error

  const { data: variants, error: vErr } = await supabase
    .from('product_variants')
    .select('*')
  if (vErr) throw vErr

  return products.map((p) => ({
    ...mapProductRow(p),
    variants: variants.filter((v) => v.product_id === p.id).map(mapVariantRow),
  }))
}

export async function getAdminProduct(id: string): Promise<ProductWithVariants | null> {
  const supabase = createAdminClient()
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single()
  if (!p) return null
  const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', id)
  return { ...mapProductRow(p), variants: (variants ?? []).map(mapVariantRow) }
}
