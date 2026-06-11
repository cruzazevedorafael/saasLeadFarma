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
    weightGrams: Number(r.weight_grams ?? 0),
    imageUrl: null,
  }
}

function mapOrder(r: any): OrderWithItems {
  const items: OrderItem[] = (r.order_items ?? []).map(mapItem)
  const weightTotalGrams = items.reduce((acc, it) => acc + it.weightGrams * it.quantity, 0)
  return {
    id: r.id,
    number: Number(r.number),
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    status: r.status,
    priceType: r.price_type,
    total: Number(r.total ?? 0),
    itemsSubtotal: Number(r.items_subtotal ?? 0),
    shippingLabel: r.shipping_label ?? '',
    shippingPrice: Number(r.shipping_price ?? 0),
    paymentLabel: r.payment_label ?? '',
    paymentSurcharge: Number(r.payment_surcharge ?? 0),
    stockWarning: r.stock_warning ?? null,
    weightTotalGrams,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    items,
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

// Detalhe de um pedido, com a foto de cada item buscada pelo product_id
// (o item guarda só o product_id; a foto vem do cadastro atual do produto).
export async function getAdminOrder(id: string): Promise<OrderWithItems | null> {
  const db = createAdminClient()
  const { data, error } = await db.from('orders').select('*, order_items(*)').eq('id', id).single()
  if (error || !data) return null
  const order = mapOrder(data)
  const ids = [...new Set(order.items.map((i) => i.productId).filter((x): x is string => !!x))]
  if (ids.length > 0) {
    const { data: prods } = await db.from('products').select('id, image_url').in('id', ids)
    const fotos = new Map((prods ?? []).map((p: any) => [p.id, (p.image_url ?? null) as string | null]))
    order.items = order.items.map((it) => ({
      ...it,
      imageUrl: it.productId ? fotos.get(it.productId) ?? null : null,
    }))
  }
  return order
}
