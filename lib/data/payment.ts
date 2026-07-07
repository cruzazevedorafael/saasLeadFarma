// lib/data/payment.ts
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface PaymentMethod {
  id: string
  name: string
  surchargePercent: number
  surchargeFixed: number
  active: boolean
  sortOrder: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function map(r: any): PaymentMethod {
  return {
    id: r.id, name: r.name,
    surchargePercent: Number(r.surcharge_percent ?? 0),
    surchargeFixed: Number(r.surcharge_fixed ?? 0),
    active: r.active ?? true, sortOrder: Number(r.sort_order ?? 0),
  }
}

// PAINEL: client autenticado → RLS isola pela farmácia do usuário.
export async function getPaymentMethods(activeOnly = false): Promise<PaymentMethod[]> {
  const supabase = await createServerClient()
  let q = supabase.from('payment_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(map)
}

// PÚBLICO (anon): formas ativas de UMA farmácia (catálogo).
export async function getPublicPaymentMethods(pharmacyId: string): Promise<PaymentMethod[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map(map)
}
