// lib/data/shipping.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface ShippingMethod {
  id: string
  name: string
  price: number
  active: boolean
  sortOrder: number
}

function map(r: any): ShippingMethod {
  return {
    id: r.id, name: r.name, price: Number(r.price ?? 0),
    active: r.active ?? true, sortOrder: Number(r.sort_order ?? 0),
  }
}

export async function getShippingMethods(activeOnly = false): Promise<ShippingMethod[]> {
  const db = createAdminClient()
  let q = db.from('shipping_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(map)
}
