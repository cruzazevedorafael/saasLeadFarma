// app/painel/relatorios/page.tsx — inteligência de vendas (últimos 12 meses).
import Link from 'next/link'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getAnalytics } from '@/lib/data/analytics'
import { BarList } from './_components/bar-list'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}

export default async function RelatoriosPage() {
  await requirePharmacyAdmin()
  const a = await getAnalytics()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-xs text-muted-foreground">Vendas dos últimos 12 meses.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Faturamento" value={brl(a.faturamento)} hint={`${a.concluidos} pedido(s) concluído(s)`} />
        <Card label="Ticket médio" value={brl(a.ticketMedio)} />
        <Card label="Pedidos" value={String(a.totalPedidos)} hint={`${a.cancelados} cancelado(s)`} />
        <Card label="Itens vendidos" value={String(a.itensVendidos)} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Mais vendidos</h2>
          {a.topProdutos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas ainda.</p>
          ) : (
            <div className="space-y-2">
              {a.topProdutos.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <span className="truncate"><span className="text-muted-foreground mr-1">{i + 1}.</span>{p.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{p.qtd} un · {brl(p.receita)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Por categoria (receita)</h2>
          <BarList data={a.porCategoria} metric="receita" />
        </section>

        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Por mês (receita)</h2>
          <BarList data={a.porMes} metric="receita" />
        </section>

        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Por dia da semana (pedidos)</h2>
          <BarList data={a.porDiaSemana} metric="pedidos" />
        </section>

        <section className="rounded-xl border border-border p-4 space-y-3 md:col-span-2">
          <h2 className="font-semibold text-sm">Por horário (pedidos)</h2>
          <BarList data={a.porHora} metric="pedidos" />
        </section>
      </div>
    </div>
  )
}
