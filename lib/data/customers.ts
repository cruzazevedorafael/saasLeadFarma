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

// Registro DETALHADO de cada venda do cliente (snapshot cadastral no momento da
// compra + itens + valores + datas). Serve como prova/registro para a farmácia.
export interface DetailedOrderItem {
  code: string; name: string; size: string; color: string; quantity: number; unitPrice: number
}
export interface DetailedCustomerOrder {
  id: string; number: number
  status: 'pending' | 'completed' | 'cancelled'; priceType: string
  createdAt: string; completedAt: string | null; cancelledAt: string | null
  snapName: string; snapCpf: string; snapPhone: string
  snapCep: string; snapLogradouro: string; snapNumero: string; snapComplemento: string
  snapBairro: string; snapCidade: string; snapUf: string
  itemsSubtotal: number; shippingLabel: string; shippingPrice: number
  paymentLabel: string; paymentSurcharge: number; total: number
  items: DetailedOrderItem[]
}

export async function getCustomerOrdersDetailed(customerId: string): Promise<DetailedCustomerOrder[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(product_code, product_name, size, color, quantity, unit_price)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((o: any) => ({
    id: o.id, number: Number(o.number), status: o.status, priceType: o.price_type ?? 'retail',
    createdAt: o.created_at, completedAt: o.completed_at ?? null, cancelledAt: o.cancelled_at ?? null,
    snapName: o.customer_name ?? '', snapCpf: o.customer_cpf ?? '', snapPhone: o.customer_phone ?? '',
    snapCep: o.customer_cep ?? '', snapLogradouro: o.customer_logradouro ?? '', snapNumero: o.customer_numero ?? '',
    snapComplemento: o.customer_complemento ?? '', snapBairro: o.customer_bairro ?? '',
    snapCidade: o.customer_cidade ?? '', snapUf: o.customer_uf ?? '',
    itemsSubtotal: Number(o.items_subtotal ?? 0), shippingLabel: o.shipping_label ?? '',
    shippingPrice: Number(o.shipping_price ?? 0), paymentLabel: o.payment_label ?? '',
    paymentSurcharge: Number(o.payment_surcharge ?? 0), total: Number(o.total ?? 0),
    items: (o.order_items ?? []).map((it: any) => ({
      code: it.product_code ?? '', name: it.product_name ?? 'Produto', size: it.size ?? '', color: it.color ?? '',
      quantity: Number(it.quantity ?? 0), unitPrice: Number(it.unit_price ?? 0),
    })),
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
