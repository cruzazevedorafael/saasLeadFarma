// lib/data/finance.ts
import { createAdminClient } from '@/lib/supabase/admin'

interface SummItem { unitPrice: number; unitCost: number; quantity: number }
interface SummOrder { completedAt: string; items: SummItem[] }

export interface MonthlySummary {
  revenue: number
  cost: number
  profit: number
  byDay: { day: number; revenue: number }[]
}

export function summarize(orders: SummOrder[]): MonthlySummary {
  let revenue = 0
  let cost = 0
  const days = new Map<number, number>()
  for (const o of orders) {
    const day = new Date(o.completedAt).getUTCDate()
    for (const it of o.items) {
      const r = it.unitPrice * it.quantity
      revenue += r
      cost += it.unitCost * it.quantity
      days.set(day, (days.get(day) ?? 0) + r)
    }
  }
  const byDay = [...days.entries()].sort((a, b) => a[0] - b[0]).map(([day, revenue]) => ({ day, revenue }))
  return { revenue, cost, profit: revenue - cost, byDay }
}

// year/month (month 1-12). Lê pedidos baixados no mês e resume.
export async function getMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const db = createAdminClient()
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, month, 1)).toISOString()
  const { data, error } = await db
    .from('orders')
    .select('completed_at, order_items(unit_price, unit_cost, quantity)')
    .eq('status', 'completed')
    .gte('completed_at', start)
    .lt('completed_at', end)
  if (error) throw error
  const orders: SummOrder[] = (data ?? []).map((o: any) => ({
    completedAt: o.completed_at,
    items: (o.order_items ?? []).map((i: any) => ({
      unitPrice: Number(i.unit_price ?? 0),
      unitCost: Number(i.unit_cost ?? 0),
      quantity: Number(i.quantity ?? 0),
    })),
  }))
  return summarize(orders)
}
