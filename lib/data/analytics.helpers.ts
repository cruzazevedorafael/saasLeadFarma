// lib/data/analytics.helpers.ts — cálculos de relatório (puro, testável).

export interface AnalyticsOrderItem {
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
}
export interface AnalyticsOrder {
  total: number
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: string
  items: AnalyticsOrderItem[]
}

export interface TopProduto { name: string; qtd: number; receita: number }
export interface Bucket { label: string; pedidos: number; receita: number }

export interface Analytics {
  totalPedidos: number
  concluidos: number
  cancelados: number
  faturamento: number      // soma dos concluídos
  ticketMedio: number      // faturamento / concluídos
  itensVendidos: number    // qtd de itens (não cancelados)
  topProdutos: TopProduto[]
  porCategoria: Bucket[]
  porMes: Bucket[]
  porDiaSemana: Bucket[]
  porHora: Bucket[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function computeAnalytics(
  orders: AnalyticsOrder[],
  categoryByProduct: Record<string, string> = {},
): Analytics {
  const validas = orders.filter((o) => o.status !== 'cancelled')
  const concluidas = orders.filter((o) => o.status === 'completed')

  const faturamento = round2(concluidas.reduce((a, o) => a + o.total, 0))
  const concluidos = concluidas.length

  const prod = new Map<string, TopProduto>()
  const cat = new Map<string, Bucket>()
  const mes = new Map<string, Bucket>()
  const dia = new Map<number, Bucket>()
  const hora = new Map<number, Bucket>()
  let itensVendidos = 0

  const bump = (m: Map<any, Bucket>, key: any, label: string, receita: number) => {
    const b = m.get(key) ?? { label, pedidos: 0, receita: 0 }
    b.pedidos += 1
    b.receita = round2(b.receita + receita)
    m.set(key, b)
  }

  for (const o of validas) {
    const d = new Date(o.createdAt)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    bump(mes, ym, ym, o.total)
    bump(dia, d.getDay(), DIAS[d.getDay()], o.total)
    bump(hora, d.getHours(), `${String(d.getHours()).padStart(2, '0')}h`, o.total)

    for (const it of o.items) {
      itensVendidos += it.quantity
      const receita = round2(it.quantity * it.unitPrice)
      const p = prod.get(it.productName) ?? { name: it.productName, qtd: 0, receita: 0 }
      p.qtd += it.quantity
      p.receita = round2(p.receita + receita)
      prod.set(it.productName, p)

      const categoria = (it.productId && categoryByProduct[it.productId]) || 'Sem categoria'
      const c = cat.get(categoria) ?? { label: categoria, pedidos: 0, receita: 0 }
      c.pedidos += it.quantity
      c.receita = round2(c.receita + receita)
      cat.set(categoria, c)
    }
  }

  return {
    totalPedidos: orders.length,
    concluidos,
    cancelados: orders.filter((o) => o.status === 'cancelled').length,
    faturamento,
    ticketMedio: concluidos > 0 ? round2(faturamento / concluidos) : 0,
    itensVendidos,
    topProdutos: [...prod.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 10),
    porCategoria: [...cat.values()].sort((a, b) => b.receita - a.receita),
    porMes: [...mes.values()].sort((a, b) => a.label.localeCompare(b.label)),
    porDiaSemana: Array.from({ length: 7 }, (_, i) => dia.get(i) ?? { label: DIAS[i], pedidos: 0, receita: 0 }),
    porHora: [...hora.values()].sort((a, b) => a.label.localeCompare(b.label)),
  }
}
