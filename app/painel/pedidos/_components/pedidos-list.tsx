// app/painel/pedidos/_components/pedidos-list.tsx
// Lista de pedidos com Supabase Realtime: pedido novo entra no topo com destaque
// visual (.order-highlight, ~2s) sem precisar recarregar a página.
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrderWithItems, OrderStatus } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { PedidoCard } from './pedido-card'

// Mapeamento local (snake_case → camelCase) só para o payload do Realtime.
// Não importa lib/data/orders.ts de propósito: esse módulo carrega o client
// admin (service_role), que nunca pode entrar no bundle do browser.
function mapItemRow(r: any) {
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

function mapOrderRow(r: any, itemRows: any[]): OrderWithItems {
  const items = itemRows.map(mapItemRow)
  const weightTotalGrams = items.reduce((acc, it) => acc + it.weightGrams * it.quantity, 0)
  return {
    id: r.id,
    number: Number(r.number),
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    customerCpf: r.customer_cpf ?? '',
    customerCep: r.customer_cep ?? '',
    customerLogradouro: r.customer_logradouro ?? '',
    customerNumero: r.customer_numero ?? '',
    customerComplemento: r.customer_complemento ?? '',
    customerBairro: r.customer_bairro ?? '',
    customerCidade: r.customer_cidade ?? '',
    customerUf: r.customer_uf ?? '',
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

export function PedidosList({
  initialPedidos,
  pharmacy,
  statusFiltro,
}: {
  initialPedidos: OrderWithItems[]
  pharmacy: Pharmacy
  statusFiltro?: OrderStatus
}) {
  const [pedidos, setPedidos] = useState(initialPedidos)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    // Pedido novo sempre nasce "pending" — só vale inserir ao vivo nas listas
    // que mostram pendente (filtro "Pendentes" ou "Todos").
    if (statusFiltro && statusFiltro !== 'pending') return

    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      if (cancelled) return

      channel = supabase
        .channel(`orders-${pharmacy.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders', filter: `pharmacy_id=eq.${pharmacy.id}` },
          async (payload) => {
            const { data: itemRows } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', (payload.new as { id: string }).id)
            const novo = mapOrderRow(payload.new, itemRows ?? [])
            setPedidos((atual) => [novo, ...atual.filter((p) => p.id !== novo.id)])
            setHighlightId(novo.id)
            window.setTimeout(() => setHighlightId((id) => (id === novo.id ? null : id)), 2200)
          },
        )
        .subscribe()
    }

    subscribe()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [pharmacy.id, statusFiltro])

  if (pedidos.length === 0) {
    return <p className="text-muted-foreground">Nenhum pedido nesta lista.</p>
  }

  return (
    <div className="space-y-3">
      {pedidos.map((o) => (
        <PedidoCard key={o.id} order={o} pharmacy={pharmacy} highlighted={o.id === highlightId} />
      ))}
    </div>
  )
}
