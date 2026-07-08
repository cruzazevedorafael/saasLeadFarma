// lib/data/customers.ts — clientes por farmácia (dado atual + histórico).
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface CustomerAddress {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

export interface Customer extends CustomerAddress {
  id: string
  cpf: string
  name: string
  phone: string
  lgpdConsent: boolean
  ordersCount: number
  updatedAt: string
}

export interface CustomerHistory extends CustomerAddress {
  id: string
  name: string
  phone: string
  createdAt: string
}

function mapCustomer(r: any): Customer {
  return {
    id: r.id, cpf: r.cpf, name: r.name, phone: r.phone ?? '',
    cep: r.cep ?? '', logradouro: r.logradouro ?? '', numero: r.numero ?? '',
    complemento: r.complemento ?? '', bairro: r.bairro ?? '', cidade: r.cidade ?? '', uf: r.uf ?? '',
    lgpdConsent: r.lgpd_consent ?? false, ordersCount: Number(r.orders_count ?? 0),
    updatedAt: r.updated_at,
  }
}

// PAINEL: lista de clientes da farmácia logada (RLS isola por tenant).
export async function getCustomers(): Promise<Customer[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapCustomer)
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createServerClient()
  const { data } = await supabase.from('customers').select('*').eq('id', id).single()
  return data ? mapCustomer(data) : null
}

export interface CustomerOrder {
  id: string
  number: number
  total: number
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: string
}

// Pedidos feitos por este cliente (RLS isola pela farmácia logada).
export async function getCustomerOrders(customerId: string): Promise<CustomerOrder[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('orders')
    .select('id, number, total, status, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((o: any) => ({
    id: o.id, number: Number(o.number), total: Number(o.total ?? 0),
    status: o.status, createdAt: o.created_at,
  }))
}

export async function getCustomerHistory(customerId: string): Promise<CustomerHistory[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('customer_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name ?? '', phone: r.phone ?? '',
    cep: r.cep ?? '', logradouro: r.logradouro ?? '', numero: r.numero ?? '',
    complemento: r.complemento ?? '', bairro: r.bairro ?? '', cidade: r.cidade ?? '', uf: r.uf ?? '',
    createdAt: r.created_at,
  }))
}
