// lib/data/products.ts
import { createClient as createServerClient } from '@/lib/supabase/server'
import { mapProductRow, mapVariantRow } from './mappers'
import type { ProductWithVariants } from './types'

// PÚBLICO (anon): catálogo de UMA farmácia. Lê as VIEWS public_* filtrando por
// pharmacy_id (a view expõe pharmacy_id/slug e já filtra farmácia ativa).
export async function getPublicProducts(pharmacyId: string): Promise<ProductWithVariants[]> {
  const supabase = await createServerClient()
  const { data: products, error } = await supabase
    .from('public_products')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .order('sort_order', { ascending: true })
  if (error) throw error

  const ids = products.map((p) => p.id)
  const { data: variants, error: vErr } = await supabase
    .from('public_product_variants')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .in('product_id', ids)
  if (vErr) throw vErr

  return products.map((p) => ({
    ...mapProductRow({ ...p, price_cost: 0, active: true }),
    variants: variants.filter((v) => v.product_id === p.id).map((v) => mapVariantRow(v)),
  }))
}

// PAINEL: produtos completos (custo/estoque). Usa o client AUTENTICADO —
// o RLS ("products tenant all") isola pela farmácia do usuário logado.
export async function getAdminProducts(): Promise<ProductWithVariants[]> {
  const supabase = await createServerClient()
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
  const supabase = await createServerClient()
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single()
  if (!p) return null
  const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', id)
  return { ...mapProductRow(p), variants: (variants ?? []).map(mapVariantRow) }
}
