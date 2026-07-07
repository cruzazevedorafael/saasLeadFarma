// app/painel/cadastro/page.tsx — cadastro obrigatório da empresa (onboarding).
import { requirePharmacyAdmin, getCurrentPharmacy } from '@/lib/auth/guards'
import { CadastroForm } from './cadastro-form'
import type { CadastroInput } from './actions'

export default async function CadastroPage() {
  await requirePharmacyAdmin({ skipOnboardingGate: true })
  const ph = await getCurrentPharmacy()

  const initial: Partial<CadastroInput> = {
    razaoSocial: ph.razaoSocial ?? '',
    nomeFantasia: ph.nomeFantasia ?? '',
    cnpj: ph.cnpj ?? '',
    cep: ph.cep ?? '',
    logradouro: ph.logradouro ?? '',
    numero: ph.numero ?? '',
    bairro: ph.bairro ?? '',
    cidade: ph.cidade ?? '',
    uf: ph.uf ?? '',
    telefone: ph.telefone ?? '',
    email: ph.email ?? '',
    farmaceuticoResponsavel: ph.farmaceuticoResponsavel ?? '',
    crf: ph.crf ?? '',
    whatsappNumber: ph.whatsappNumber ?? '',
  }

  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dados da farmácia</h1>
        <p className="text-sm text-muted-foreground">
          {ph.onboardingCompleted
            ? 'Atualize os dados cadastrais da sua farmácia.'
            : 'Preencha os dados da sua farmácia para começar a usar o LeadFarma. Todos os campos são obrigatórios.'}
        </p>
      </div>
      <CadastroForm initial={initial} />
    </div>
  )
}
