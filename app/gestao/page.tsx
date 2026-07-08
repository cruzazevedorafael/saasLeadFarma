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

      <div className="overflow-x-auto rounded-xl border border-border">
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
