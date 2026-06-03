// app/_actions/criar-pedido.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStoreSettings } from '@/lib/data/settings'
import { mapProductRow, mapVariantRow } from '@/lib/data/mappers'
import { buildOrder, validateStock, type RequestedItem, type ChosenShipping, type ChosenPayment } from '@/lib/data/order.helpers'
import type { ProductWithVariants } from '@/lib/data/types'

export interface CriarPedidoInput {
  customerName: string
  customerPhone: string
  items: RequestedItem[]
  shippingMethodId?: string | null
  paymentMethodId?: string | null
}

export interface CriarPedidoResult {
  number: number
  total: number
  priceType: 'retail' | 'wholesale'
}

export async function criarPedido(input: CriarPedidoInput): Promise<CriarPedidoResult> {
  if (!input.items?.length) throw new Error('Carrinho vazio')

  const db = createAdminClient()
  const ids = [...new Set(input.items.map((i) => i.productId))]

  const { data: prows, error } = await db.from('products').select('*').in('id', ids)
  if (error) throw error
  const { data: vrows, error: vErr } = await db.from('product_variants').select('*').in('product_id', ids)
  if (vErr) throw vErr

  const products: ProductWithVariants[] = (prows ?? []).map((p) => ({
    ...mapProductRow(p),
    variants: (vrows ?? []).filter((v) => v.product_id === p.id).map(mapVariantRow),
  }))

  validateStock(products, input.items)

  // resolve envio/pagamento a partir do banco (não confia em valores do cliente)
  let shipping: ChosenShipping | undefined
  if (input.shippingMethodId) {
    const { data: s } = await db.from('shipping_methods').select('name, price').eq('id', input.shippingMethodId).single()
    if (s) shipping = { label: s.name, price: Number(s.price ?? 0) }
  }
  let payment: ChosenPayment | undefined
  if (input.paymentMethodId) {
    const { data: pm } = await db.from('payment_methods').select('name, surcharge_percent, surcharge_fixed').eq('id', input.paymentMethodId).single()
    if (pm) payment = { label: pm.name, percent: Number(pm.surcharge_percent ?? 0), fixed: Number(pm.surcharge_fixed ?? 0) }
  }

  const settings = await getStoreSettings()
  const built = buildOrder(products, input.items, settings.wholesaleThreshold, shipping, payment)

  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      status: 'pending',
      price_type: built.priceType,
      items_subtotal: built.itemsSubtotal,
      shipping_label: built.shippingLabel,
      shipping_price: built.shippingPrice,
      payment_label: built.paymentLabel,
      payment_surcharge: built.paymentSurcharge,
      total: built.total,
    })
    .select('id, number')
    .single()
  if (oErr) throw oErr

  const itemRows = built.items.map((it) => ({ ...it, order_id: order.id }))
  const { error: iErr } = await db.from('order_items').insert(itemRows)
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw iErr
  }

  return { number: order.number as number, total: built.total, priceType: built.priceType }
}
