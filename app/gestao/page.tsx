// app/gestao/page.tsx — lista de farmácias + criação (super-admin).
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { NovaFarmaciaForm } from './_components/nova-farmacia-form'
import { StatusToggle } from './_components/status-toggle'
import { planLabel, subscriptionLabel } from '@/lib/asaas/plans'

export default async function GestaoHome() {
  const db = createAdminClient()
  const { data: pharmacies } = await db
    .from('pharmacies')
    .select('id, slug, nome_exibicao, nome_fantasia, status, onboarding_completed, plan, subscription_status, created_at')
    .order('created_at', { ascending: false })

  const rows = pharmacies ?? []

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Farmácias</h1>
        <p className="text-sm text-muted-foreground">{rows.length} cadastrada{rows.length !== 1 ? 's' : ''} na plataforma.</p>
      </div>

      <NovaFarmaciaForm />

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma farmácia ainda. Crie a primeira acima.</p>
        ) : rows.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.nome_exibicao ?? p.nome_fantasia ?? '—'}</p>
                <Link href={`/f/${p.slug}`} target="_blank" className="text-xs text-[#F97316] hover:underline">/f/{p.slug}</Link>
              </div>
              <StatusToggle id={p.id} status={p.status} />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className={`px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-500'}`}>{p.status === 'active' ? 'ativa' : 'suspensa'}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{planLabel(p.plan)} · {subscriptionLabel(p.subscription_status)}</span>
              <span className={`px-2 py-0.5 rounded-full ${p.onboarding_completed ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>{p.onboarding_completed ? 'cadastro completo' : 'cadastro pendente'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Farmácia</th>
              <th className="p-3 font-medium">Catálogo</th>
              <th className="p-3 font-medium">Cadastro</th>
              <th className="p-3 font-medium">Plano</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 font-medium">{p.nome_exibicao ?? p.nome_fantasia ?? '—'}</td>
                <td className="p-3">
                  <Link href={`/f/${p.slug}`} className="text-[#F97316] hover:underline" target="_blank">/f/{p.slug}</Link>
                </td>
                <td className="p-3">
                  {p.onboarding_completed
                    ? <span className="text-emerald-600">completo</span>
                    : <span className="text-muted-foreground">pendente</span>}
                </td>
                <td className="p-3">
                  <span>{planLabel(p.plan)}</span>
                  <span className="block text-xs text-muted-foreground">{subscriptionLabel(p.subscription_status)}</span>
                </td>
                <td className="p-3">
                  {p.status === 'active'
                    ? <span className="text-emerald-600">ativa</span>
                    : <span className="text-destructive">suspensa</span>}
                </td>
                <td className="p-3">
                  <StatusToggle id={p.id} status={p.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma farmácia ainda. Crie a primeira acima.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
