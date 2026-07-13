// lib/data/analytics.ts — busca pedidos da farmácia (RLS) e calcula os relatórios.
import { createClient as createServerClient } from '@/lib/supabase/server'
import { computeAnalytics, type Analytics, type AnalyticsOrder } from './analytics.helpers'

// Calcula os relatórios da farmácia no período dado (default: últimos 12 meses).
export async function getAnalytics(range?: { since: string; until: string }): Promise<Analytics> {
  const supabase = await createServerClient()
  const since = range?.since ?? new Date(Date.now() - 365 * 86400_000).toISOString()
  const until = range?.until ?? new Date().toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select('total, status, created_at, order_items(product_id, product_name, quantity, unit_price)')
    .gte('created_at', since)
    .lte('created_at', until)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw error

  const orders: AnalyticsOrder[] = (data ?? []).map((o: any) => ({
    total: Number(o.total ?? 0),
    status: o.status,
    createdAt: o.created_at,
    items: (o.order_items ?? []).map((it: any) => ({
      productId: it.product_id ?? null,
      productName: it.product_name ?? 'Produto',
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unit_price ?? 0),
    })),
  }))

  // categoria atual de cada produto (para o gráfico por categoria)
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)).filter((x): x is string => !!x))]
  const categoryByProduct: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: prods } = await supabase.from('products').select('id, category').in('id', ids)
    for (const p of prods ?? []) categoryByProduct[(p as any).id] = (p as any).category || 'Sem categoria'
  }

  return computeAnalytics(orders, categoryByProduct)
}
