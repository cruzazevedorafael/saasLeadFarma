// app/_actions/criar-pedido.ts
'use server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPharmacyById } from '@/lib/data/pharmacy'
import { mapProductRow, mapVariantRow } from '@/lib/data/mappers'
import { buildOrder, stockShortages, type ChosenShipping, type ChosenPayment } from '@/lib/data/order.helpers'
import type { ProductWithVariants } from '@/lib/data/types'
import { onlyDigits } from '@/lib/cpf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

const clienteSchema = z.object({
  cpf: z.string().max(20),
  cep: z.string().max(12),
  logradouro: z.string().max(200),
  numero: z.string().max(20),
  complemento: z.string().max(200),
  bairro: z.string().max(120),
  cidade: z.string().max(120),
  uf: z.string().max(2),
  lgpdConsent: z.boolean(),
})

const itemSchema = z.object({
  productId: z.string().min(1),
  size: z.string().max(60),
  color: z.string().max(60),
  quantity: z.number().int().positive().max(999),
})

const criarPedidoSchema = z.object({
  pharmacyId: z.string().min(1),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(20),
  cliente: clienteSchema.nullable().optional(),
  items: z.array(itemSchema).min(1).max(100),
  shippingMethodId: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  cartId: z.string().nullable().optional(),
})

export type CriarPedidoInput = z.infer<typeof criarPedidoSchema>
export type CriarPedidoCliente = NonNullable<CriarPedidoInput['cliente']>

// Erros esperados (produto removido, banco fora) voltam como { ok: false } com
// mensagem própria — em produção o Next mascara mensagens de erro lançadas em
// server actions, então lançar deixaria o cliente sem saber o motivo.
// Estoque insuficiente NÃO bloqueia: o pedido é registrado com o aviso em
// stockWarning e a loja resolve com o cliente.
export type CriarPedidoResult =
  | { ok: true; number: number; total: number; priceType: 'retail' | 'wholesale'; stockWarning: string | null }
  | { ok: false; error: string }

export async function criarPedido(input: unknown): Promise<CriarPedidoResult> {
  const parsed = criarPedidoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Dados do pedido inválidos. Atualize a página e tente de novo.' }

  const ip = await getClientIp()
  const rl = await checkRateLimit('criarPedido', ip)
  if (!rl.ok) return { ok: false, error: rl.error! }

  try {
    return await registrarPedido(parsed.data)
  } catch (e) {
    console.error('[criarPedido] falha ao registrar pedido:', e)
    return { ok: false, error: 'Não foi possível registrar o pedido. Verifique sua internet e tente de novo.' }
  }
}

async function registrarPedido(input: CriarPedidoInput): Promise<CriarPedidoResult> {
  if (!input.items?.length) return { ok: false, error: 'Carrinho vazio' }
  if (!input.pharmacyId) return { ok: false, error: 'Farmácia não identificada.' }

  const pharmacy = await getPharmacyById(input.pharmacyId)
  if (!pharmacy || pharmacy.status !== 'active') {
    return { ok: false, error: 'Esta farmácia não está disponível para pedidos no momento.' }
  }

  const db = createAdminClient()
  const ids = [...new Set(input.items.map((i) => i.productId))]

  // Todas as leituras/escritas são presas à farmácia do catálogo (input.pharmacyId).
  const { data: prows, error } = await db.from('products').select('*').eq('pharmacy_id', input.pharmacyId).in('id', ids)
  if (error) throw error
  const { data: vrows, error: vErr } = await db.from('product_variants').select('*').eq('pharmacy_id', input.pharmacyId).in('product_id', ids)
  if (vErr) throw vErr

  const products: ProductWithVariants[] = (prows ?? []).map((p) => ({
    ...mapProductRow(p),
    variants: (vrows ?? []).filter((v) => v.product_id === p.id).map(mapVariantRow),
  }))

  // Sem o cadastro do produto não dá pra montar o item (carrinho antigo no
  // celular do cliente apontando pra produto apagado): aí sim bloqueia.
  const existentes = new Set(products.map((p) => p.id))
  if (input.items.some((i) => !existentes.has(i.productId))) {
    return { ok: false, error: 'Um dos produtos do carrinho não está mais no catálogo. Atualize a página e monte o carrinho de novo.' }
  }

  const faltas = stockShortages(products, input.items)
  const stockWarning = faltas.length
    ? `Estoque insuficiente: ${faltas.map((f) => `${f.name} (${f.size}/${f.color}) — pedido ${f.requested}, restam ${f.stock}`).join('; ')}`
    : null

  // resolve envio/pagamento a partir do banco (não confia em valores do cliente)
  let shipping: ChosenShipping | undefined
  if (input.shippingMethodId) {
    const { data: s } = await db.from('shipping_methods').select('name, price').eq('id', input.shippingMethodId).eq('pharmacy_id', input.pharmacyId).single()
    if (s) shipping = { label: s.name, price: Number(s.price ?? 0) }
  }
  let payment: ChosenPayment | undefined
  if (input.paymentMethodId) {
    const { data: pm } = await db.from('payment_methods').select('name, surcharge_percent, surcharge_fixed').eq('id', input.paymentMethodId).eq('pharmacy_id', input.pharmacyId).single()
    if (pm) payment = { label: pm.name, percent: Number(pm.surcharge_percent ?? 0), fixed: Number(pm.surcharge_fixed ?? 0) }
  }

  const threshold = pharmacy.wholesaleThreshold ?? 4
  const built = buildOrder(products, input.items, threshold, shipping, payment)

  const cli = input.cliente
  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({
      pharmacy_id: input.pharmacyId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_cpf: cli ? onlyDigits(cli.cpf) : '',
      customer_cep: cli?.cep ?? '',
      customer_logradouro: cli?.logradouro ?? '',
      customer_numero: cli?.numero ?? '',
      customer_complemento: cli?.complemento ?? '',
      customer_bairro: cli?.bairro ?? '',
      customer_cidade: cli?.cidade ?? '',
      customer_uf: cli?.uf ?? '',
      status: 'pending',
      price_type: built.priceType,
      items_subtotal: built.itemsSubtotal,
      shipping_label: built.shippingLabel,
      shipping_price: built.shippingPrice,
      payment_label: built.paymentLabel,
      payment_surcharge: built.paymentSurcharge,
      total: built.total,
      stock_warning: stockWarning,
    })
    .select('id, number')
    .single()
  if (oErr) throw oErr

  const itemRows = built.items.map((it) => ({ ...it, order_id: order.id, pharmacy_id: input.pharmacyId }))
  const { error: iErr } = await db.from('order_items').insert(itemRows)
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw iErr
  }

  // Cadastro do cliente (registro/histórico) só é gravado COM consentimento LGPD.
  // O pedido em si já guarda o snapshot acima (necessário pra atender a venda).
  // Falha aqui não derruba o pedido — a venda continua válida.
  if (cli && cli.lgpdConsent && onlyDigits(cli.cpf).length === 11) {
    try {
      const { data: customerId, error: cErr } = await db.rpc('upsert_customer', {
        p_pharmacy_id: input.pharmacyId, p_cpf: onlyDigits(cli.cpf),
        p_name: input.customerName, p_phone: input.customerPhone,
        p_cep: cli.cep, p_logradouro: cli.logradouro, p_numero: cli.numero,
        p_complemento: cli.complemento, p_bairro: cli.bairro, p_cidade: cli.cidade,
        p_uf: cli.uf, p_consent: true,
      })
      if (cErr) throw cErr
      if (customerId) {
        await db.from('orders').update({ customer_id: customerId }).eq('id', order.id)
        await db.rpc('increment_customer_orders', { p_customer_id: customerId })
      }
    } catch (e) {
      console.error('[criarPedido] falha ao gravar cliente (pedido mantido):', e)
    }
  }

  // Reserva o estoque (desconta as peças). Pode ficar negativo — não bloqueia,
  // o stockWarning acima já avisa a loja. Se a reserva falhar, desfaz o pedido.
  const { error: rErr } = await db.rpc('reserve_order', { p_order_id: order.id })
  if (rErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw rErr
  }

  // Já baixamos o estoque de verdade; solta as reservas de carrinho desse cliente
  // pra não descontar duas vezes. Falha aqui não derruba o pedido (a reserva
  // expira sozinha em 30 min).
  if (input.cartId) {
    const { error: lErr } = await db.rpc('liberar_carrinho', { p_cart_id: input.cartId })
    if (lErr) console.error('[criarPedido] falha ao liberar carrinho:', lErr)
  }

  return { ok: true, number: order.number as number, total: built.total, priceType: built.priceType, stockWarning }
}
