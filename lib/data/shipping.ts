// lib/data/shipping.ts
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface ShippingMethod {
  id: string
  name: string
  price: number
  active: boolean
  sortOrder: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function map(r: any): ShippingMethod {
  return {
    id: r.id, name: r.name, price: Number(r.price ?? 0),
    active: r.active ?? true, sortOrder: Number(r.sort_order ?? 0),
  }
}

// PAINEL: client autenticado → RLS isola pela farmácia do usuário.
export async function getShippingMethods(activeOnly = false): Promise<ShippingMethod[]> {
  const supabase = await createServerClient()
  let q = supabase.from('shipping_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(map)
}

// PÚBLICO (anon): formas ativas de UMA farmácia (catálogo).
export async function getPublicShippingMethods(pharmacyId: string): Promise<ShippingMethod[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('shipping_methods')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(map)
}
