// app/gestao/page.tsx — dashboard da plataforma (super-admin): KPIs gerais + farmácias com métricas.
import Link from 'next/link'
import { getPharmaciesWithMetrics, overviewFrom } from '@/lib/data/platform'
import { NovaFarmaciaForm } from './_components/nova-farmacia-form'
import { StatusToggle } from './_components/status-toggle'
import { SectionHeader } from '@/components/ui/section-header'
import { MetricCard } from '@/components/ui/metric-card'
import { planLabel, subscriptionLabel } from '@/lib/asaas/plans'
import { Building2, CheckCircle2, Clock, CreditCard, DollarSign, ShoppingBag, Package } from 'lucide-react'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export default async function GestaoHome() {
  const rows = await getPharmaciesWithMetrics()
  const kpi = overviewFrom(rows)

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-10">
      <div>
        <span className="eyebrow">Plataforma</span>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight leading-none">Visão geral</h1>
      </div>

      {/* KPIs gerais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Faturamento agregado" value={brl(kpi.faturamentoAgregado)} icon={<DollarSign className="h-4 w-4" />} accent hint="pedidos concluídos" />
        <MetricCard label="Farmácias" value={kpi.totalFarmacias} icon={<Building2 className="h-4 w-4" />} hint={`${kpi.ativas} ativas · ${kpi.suspensas} suspensas`} />
        <MetricCard label="Em trial" value={kpi.emTrial} icon={<Clock className="h-4 w-4" />} hint={`${kpi.assinaturasAtivas} assinantes`} />
        <MetricCard label="Pagamento pendente" value={kpi.pagamentoPendente} icon={<CreditCard className="h-4 w-4" />} hint="assinaturas past_due" />
        <MetricCard label="Total de pedidos" value={kpi.totalPedidos} icon={<ShoppingBag className="h-4 w-4" />} />
        <MetricCard label="Total de produtos" value={kpi.totalProdutos} icon={<Package className="h-4 w-4" />} />
        <MetricCard label="Assinaturas ativas" value={kpi.assinaturasAtivas} icon={<CheckCircle2 className="h-4 w-4" />} />
        <MetricCard label="Cadastro pendente" value={kpi.onboardingPendente} icon={<Clock className="h-4 w-4" />} hint="onboarding incompleto" />
      </div>

      <NovaFarmaciaForm />

      <section className="space-y-4">
        <SectionHeader label="Farmácias" title={`${rows.length} na plataforma`} description="Ordenadas por faturamento. Clique em Gerenciar para o detalhe." />

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {rows.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma farmácia ainda. Crie a primeira acima.</p>
          ) : rows.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.nome}</p>
                  <Link href={`/f/${p.slug}`} target="_blank" className="text-xs text-brand hover:underline">/f/{p.slug}</Link>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Link href={`/gestao/${p.id}`} className="text-sm font-medium text-brand hover:underline">Gerenciar</Link>
                  <StatusToggle id={p.id} status={p.status} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted/60 py-1.5"><span className="block font-semibold tabular-nums">{brl(p.faturamento)}</span><span className="text-muted-foreground">faturado</span></div>
                <div className="rounded-lg bg-muted/60 py-1.5"><span className="block font-semibold tabular-nums">{p.nPedidos}</span><span className="text-muted-foreground">pedidos</span></div>
                <div className="rounded-lg bg-muted/60 py-1.5"><span className="block font-semibold tabular-nums">{p.nProdutos}</span><span className="text-muted-foreground">produtos</span></div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className={`px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-500'}`}>{p.status === 'active' ? 'ativa' : 'suspensa'}</span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{planLabel(p.plan)} · {subscriptionLabel(p.subscriptionStatus)}</span>
                <span className={`px-2 py-0.5 rounded-full ${p.onboardingCompleted ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>{p.onboardingCompleted ? 'cadastro completo' : 'cadastro pendente'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Farmácia</th>
                <th className="p-3 font-medium text-right">Faturamento</th>
                <th className="p-3 font-medium text-right">Pedidos</th>
                <th className="p-3 font-medium text-right">Produtos</th>
                <th className="p-3 font-medium">Plano</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">
                    <span className="block font-medium">{p.nome}</span>
                    <Link href={`/f/${p.slug}`} className="text-xs text-brand hover:underline" target="_blank">/f/{p.slug}</Link>
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">{brl(p.faturamento)}</td>
                  <td className="p-3 text-right tabular-nums">{p.nPedidos}<span className="text-xs text-muted-foreground"> ({p.nConcluidos})</span></td>
                  <td className="p-3 text-right tabular-nums">{p.nProdutos}</td>
                  <td className="p-3">
                    <span>{planLabel(p.plan)}</span>
                    <span className="block text-xs text-muted-foreground">{subscriptionLabel(p.subscriptionStatus)}</span>
                  </td>
                  <td className="p-3">
                    {p.status === 'active'
                      ? <span className="text-emerald-600">ativa</span>
                      : <span className="text-destructive">suspensa</span>}
                    {!p.onboardingCompleted && <span className="block text-xs text-amber-600">cadastro pendente</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/gestao/${p.id}`} className="font-medium text-brand hover:underline">Gerenciar</Link>
                      <StatusToggle id={p.id} status={p.status} />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma farmácia ainda. Crie a primeira acima.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
