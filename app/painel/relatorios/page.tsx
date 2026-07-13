// app/painel/relatorios/page.tsx — inteligência de vendas, com filtro de período.
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getAnalytics } from '@/lib/data/analytics'
import { resolveRange } from '@/lib/data/analytics.range'
import { BarList } from './_components/bar-list'
import { RangeFilter } from './_components/range-filter'
import { MetricCard } from '@/components/ui/metric-card'
import { SectionHeader } from '@/components/ui/section-header'
import { DollarSign, Receipt, ShoppingBag, Boxes } from 'lucide-react'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requirePharmacyAdmin()
  const sp = await searchParams
  const range = resolveRange(sp)
  const a = await getAnalytics(range)
  const qs = new URLSearchParams(sp as Record<string, string>).toString()
  const to = (m: string) => `/painel/relatorios/${m}${qs ? `?${qs}` : ''}`

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Relatórios</span>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight leading-none">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{range.label} · clique numa métrica para o detalhe.</p>
        </div>
        <RangeFilter current={range.preset} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Faturamento" value={brl(a.faturamento)} hint={`${a.concluidos} concluído(s)`} href={to('faturamento')} icon={<DollarSign className="h-4 w-4" />} accent />
        <MetricCard label="Ticket médio" value={brl(a.ticketMedio)} href={to('ticket')} icon={<Receipt className="h-4 w-4" />} />
        <MetricCard label="Pedidos" value={a.totalPedidos} hint={`${a.cancelados} cancelado(s)`} href={to('pedidos')} icon={<ShoppingBag className="h-4 w-4" />} />
        <MetricCard label="Itens vendidos" value={a.itensVendidos} href={to('produtos')} icon={<Boxes className="h-4 w-4" />} />
      </div>

      <section className="space-y-4">
        <SectionHeader label="Detalhamento" title="Como as vendas se distribuem" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">Mais vendidos</h3>
            {a.topProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
            ) : (
              <div className="space-y-2">
                {a.topProdutos.slice(0, 6).map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span className="truncate"><span className="text-muted-foreground mr-1">{i + 1}.</span>{p.name}</span>
                    <span className="text-muted-foreground shrink-0 ml-2 tabular-nums">{p.qtd} un · {brl(p.receita)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">Por categoria (receita)</h3>
            <BarList data={a.porCategoria} metric="receita" />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">Por dia da semana (pedidos)</h3>
            <BarList data={a.porDiaSemana} metric="pedidos" />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-sm">Por horário (pedidos)</h3>
            <BarList data={a.porHora} metric="pedidos" />
          </div>
        </div>
      </section>
    </div>
  )
}
