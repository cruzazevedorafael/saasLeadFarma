// lib/data/payment.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface PaymentMethod {
  id: string
  name: string
  surchargePercent: number
  surchargeFixed: number
  active: boolean
  sortOrder: number
}

function map(r: any): PaymentMethod {
  return {
    id: r.id, name: r.name,
    surchargePercent: Number(r.surcharge_percent ?? 0),
    surchargeFixed: Number(r.surcharge_fixed ?? 0),
    active: r.active ?? true, sortOrder: Number(r.sort_order ?? 0),
  }
}

export async function getPaymentMethods(activeOnly = false): Promise<PaymentMethod[]> {
  const db = createAdminClient()
  let q = db.from('payment_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(map)
}
