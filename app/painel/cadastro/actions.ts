'use server'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { updatePharmacy } from '@/lib/data/pharmacy'
import { cadastroSchema, type CadastroInput } from './schema'
import { revalidatePath } from 'next/cache'

// redirect() do Next lança um "erro" com digest NEXT_REDIRECT — não é falha real.
function isRedirect(e: unknown): boolean {
  return !!e && typeof e === 'object' && 'digest' in e &&
    typeof (e as { digest?: unknown }).digest === 'string' &&
    (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')
}

export async function salvarCadastro(input: CadastroInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = cadastroSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Preencha todos os campos obrigatórios.' }
  }
  const d = parsed.data

  // 1) Confirma a sessão/farmácia (getCurrentPharmacyId faz redirect se faltar).
  let pharmacyId: string
  try {
    pharmacyId = await getCurrentPharmacyId()
  } catch (e) {
    if (isRedirect(e)) return { ok: false, error: 'Sua sessão expirou. Saia e entre de novo, depois salve.' }
    console.error('[salvarCadastro] sessão:', e)
    return { ok: false, error: 'Não foi possível confirmar sua sessão. Entre de novo e tente.' }
  }

  // 2) Grava. Qualquer erro vira mensagem clara (com o motivo real) em vez de travar.
  try {
    await updatePharmacy(pharmacyId, {
      razao_social: d.razaoSocial,
      nome_fantasia: d.nomeFantasia,
      nome_exibicao: d.nomeFantasia,
      cnpj: d.cnpj,
      cep: d.cep,
      logradouro: d.logradouro,
      numero: d.numero,
      bairro: d.bairro,
      cidade: d.cidade,
      uf: d.uf.toUpperCase(),
      telefone: d.telefone,
      email: d.email,
      farmaceutico_responsavel: d.farmaceuticoResponsavel,
      crf: d.crf,
      whatsapp_number: d.whatsappNumber,
      onboarding_completed: true,
    })
  } catch (e) {
    console.error('[salvarCadastro] falha ao gravar:', e)
    const raw = e instanceof Error ? e.message : String(e)
    if (raw.includes('Configuração do servidor')) return { ok: false, error: raw }
    // Mostra o motivo real (tela de admin) pra diagnosticar rápido.
    return { ok: false, error: `Não foi possível salvar: ${raw}` }
  }
  revalidatePath('/painel')
  return { ok: true }
}
