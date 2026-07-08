// app/gestao/[id]/page.tsx — gestão completa de uma farmácia (super-admin).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSuperadmin } from '@/lib/auth/guards'
import { getPharmacyById } from '@/lib/data/pharmacy'
import { createAdminClient } from '@/lib/supabase/admin'
import { planLabel, subscriptionLabel } from '@/lib/asaas/plans'
import { StatusToggle } from '../_components/status-toggle'
import { EditarFarmaciaForm } from './_components/editar-farmacia-form'
import { ExcluirFarmaciaButton } from './_components/excluir-farmacia-button'

async function contar(db: ReturnType<typeof createAdminClient>, table: string, pharmacyId: string) {
  const { count } = await db.from(table).select('id', { count: 'exact', head: true }).eq('pharmacy_id', pharmacyId)
  return count ?? 0
}

export default async function GestaoFarmacia({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin()
  const { id } = await params

  const pharmacy = await getPharmacyById(id)
  if (!pharmacy) notFound()

  const db = createAdminClient()
  const [produtos, pedidos, clientes] = await Promise.all([
    contar(db, 'products', id),
    contar(db, 'orders', id),
    contar(db, 'customers', id),
  ])

  const endereco = [
    pharmacy.logradouro,
    pharmacy.numero && `nº ${pharmacy.numero}`,
    pharmacy.bairro,
    pharmacy.cidade && pharmacy.uf ? `${pharmacy.cidade}/${pharmacy.uf}` : pharmacy.cidade || pharmacy.uf,
    pharmacy.cep && `CEP ${pharmacy.cep}`,
  ].filter(Boolean).join(' · ') || '—'

  const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/gestao" className="text-xs text-muted-foreground hover:underline">← Voltar às farmácias</Link>
          <h1 className="mt-1 text-2xl font-bold truncate">{pharmacy.nomeExibicao}</h1>
          <Link href={`/f/${pharmacy.slug}`} target="_blank" className="text-sm text-[#F97316] hover:underline">/f/{pharmacy.slug}</Link>
        </div>
        <div className="flex items-center gap-2">
          <StatusToggle id={pharmacy.id} status={pharmacy.status} />
        </div>
      </div>

      {/* Selos de estado */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className={`px-2 py-0.5 rounded-full ${pharmacy.status === 'active' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-500'}`}>{pharmacy.status === 'active' ? 'ativa' : 'suspensa'}</span>
        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{planLabel(pharmacy.plan)} · {subscriptionLabel(pharmacy.subscriptionStatus)}</span>
        <span className={`px-2 py-0.5 rounded-full ${pharmacy.onboardingCompleted ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>{pharmacy.onboardingCompleted ? 'cadastro completo' : 'cadastro pendente'}</span>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Produtos', value: produtos },
          { label: 'Pedidos', value: pedidos },
          { label: 'Clientes', value: clientes },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border p-4">
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Dados cadastrais atuais */}
      <div className="rounded-xl border border-border p-4 space-y-4">
        <h2 className="font-semibold">Dados cadastrais</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Info label="Razão social" value={pharmacy.razaoSocial} />
          <Info label="Nome fantasia" value={pharmacy.nomeFantasia} />
          <Info label="CNPJ" value={pharmacy.cnpj} />
          <Info label="Telefone" value={pharmacy.telefone} />
          <Info label="E-mail" value={pharmacy.email} />
          <Info label="WhatsApp" value={pharmacy.whatsappNumber} />
          <Info label="Farmacêutico responsável" value={pharmacy.farmaceuticoResponsavel} />
          <Info label="CRF" value={pharmacy.crf} />
          <Info label="Qtde. para atacado" value={pharmacy.wholesaleThreshold} />
          <div className="sm:col-span-2 lg:col-span-3">
            <Info label="Endereço" value={endereco} />
          </div>
        </dl>
      </div>

      {/* Formulário de edição */}
      <EditarFarmaciaForm pharmacy={pharmacy} />

      {/* Zona de perigo */}
      <div className="rounded-xl border border-destructive/40 p-4 space-y-3">
        <h2 className="font-semibold text-destructive">Zona de perigo</h2>
        <p className="text-sm text-muted-foreground">
          Excluir a farmácia remove permanentemente todos os seus dados (produtos, pedidos, clientes) e os logins associados. Esta ação é irreversível.
        </p>
        <ExcluirFarmaciaButton id={pharmacy.id} nome={pharmacy.nomeExibicao} />
      </div>
    </div>
  )
}
