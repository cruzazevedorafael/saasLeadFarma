// app/painel/relatorios/[metrica]/page.tsx — detalhe (drill-down) de uma métrica, no período escolhido.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getAnalytics } from '@/lib/data/analytics'
import { resolveRange } from '@/lib/data/analytics.range'
import { BarList } from '../_components/bar-list'
import { MetricCard } from '@/components/ui/metric-card'
import { ChevronLeft } from 'lucide-react'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const METRICAS = ['faturamento', 'ticket', 'pedidos', 'produtos'] as const
type Metrica = (typeof METRICAS)[number]

const TITULO: Record<Metrica, string> = {
  faturamento: 'Faturamento',
  ticket: 'Ticket médio',
  pedidos: 'Pedidos',
  produtos: 'Itens vendidos',
}

export default async function MetricaDetalhe({
  params, searchParams,
}: {
  params: Promise<{ metrica: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  await requirePharmacyAdmin()
  const { metrica } = await params
  if (!METRICAS.includes(metrica as Metrica)) notFound()
  const m = metrica as Metrica
  const sp = await searchParams
  const range = resolveRange(sp)
  const a = await getAnalytics(range)
  const qs = new URLSearchParams(sp as Record<string, string>).toString()

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-8">
      <div>
        <Link href={`/painel/relatorios${qs ? `?${qs}` : ''}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Relatórios
        </Link>
        <span className="eyebrow mt-3">{range.label}</span>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight leading-none">{TITULO[m]}</h1>
      </div>

      {m === 'faturamento' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard label="Faturamento" value={brl(a.faturamento)} accent />
            <MetricCard label="Pedidos concluídos" value={a.concluidos} />
            <MetricCard label="Ticket médio" value={brl(a.ticketMedio)} />
          </div>
          <Bloco titulo="Receita por mês"><BarList data={a.porMes} metric="receita" /></Bloco>
          <Bloco titulo="Receita por categoria"><BarList data={a.porCategoria} metric="receita" /></Bloco>
        </>
      )}

      {m === 'ticket' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard label="Ticket médio" value={brl(a.ticketMedio)} accent />
            <MetricCard label="Faturamento" value={brl(a.faturamento)} />
            <MetricCard label="Pedidos concluídos" value={a.concluidos} />
          </div>
          <p className="text-sm text-muted-foreground">Ticket médio = faturamento ÷ pedidos concluídos, no período.</p>
          <Bloco titulo="Receita por mês"><BarList data={a.porMes} metric="receita" /></Bloco>
        </>
      )}

      {m === 'pedidos' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Total" value={a.totalPedidos} accent />
            <MetricCard label="Concluídos" value={a.concluidos} />
            <MetricCard label="Cancelados" value={a.cancelados} />
            <MetricCard label="Itens vendidos" value={a.itensVendidos} />
          </div>
          <Bloco titulo="Pedidos por dia da semana"><BarList data={a.porDiaSemana} metric="pedidos" /></Bloco>
          <Bloco titulo="Pedidos por horário"><BarList data={a.porHora} metric="pedidos" /></Bloco>
        </>
      )}

      {m === 'produtos' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Itens vendidos" value={a.itensVendidos} accent />
            <MetricCard label="Produtos distintos" value={a.topProdutos.length} />
          </div>
          <Bloco titulo="Mais vendidos (completo)">
            {a.topProdutos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem vendas no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-1 font-medium">#</th><th className="py-1 font-medium">Produto</th><th className="py-1 font-medium text-right">Qtd</th><th className="py-1 font-medium text-right">Receita</th></tr>
                  </thead>
                  <tbody>
                    {a.topProdutos.map((p, i) => (
                      <tr key={p.name} className="border-t border-border">
                        <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="py-1.5">{p.name}</td>
                        <td className="py-1.5 text-right tabular-nums">{p.qtd}</td>
                        <td className="py-1.5 text-right tabular-nums">{brl(p.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloco>
        </>
      )}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <h2 className="font-semibold text-sm">{titulo}</h2>
      {children}
    </section>
  )
}
