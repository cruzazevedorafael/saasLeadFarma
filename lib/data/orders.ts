// lib/data/orders.ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrderWithItems, OrderStatus, OrderItem } from './orders.types'

function mapItem(r: any): OrderItem {
  return {
    id: r.id,
    productId: r.product_id ?? null,
    variantId: r.variant_id ?? null,
    productCode: r.product_code ?? '',
    productName: r.product_name ?? '',
    size: r.size ?? '',
    color: r.color ?? '',
    quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
  }
}

function mapOrder(r: any): OrderWithItems {
  return {
    id: r.id,
    number: Number(r.number),
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    status: r.status,
    priceType: r.price_type,
    total: Number(r.total ?? 0),
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    items: (r.order_items ?? []).map(mapItem),
  }
}

export async function getAdminOrders(status?: OrderStatus): Promise<OrderWithItems[]> {
  const db = createAdminClient()
  let q = db.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapOrder)
}
