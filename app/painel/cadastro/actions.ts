'use server'
import { z } from 'zod'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { updatePharmacy } from '@/lib/data/pharmacy'
import { revalidatePath } from 'next/cache'

export const cadastroSchema = z.object({
  razaoSocial: z.string().trim().min(2, 'Informe a razão social'),
  nomeFantasia: z.string().trim().min(2, 'Informe o nome fantasia'),
  cnpj: z.string().trim().min(11, 'CNPJ inválido'),
  cep: z.string().trim().min(8, 'CEP inválido'),
  logradouro: z.string().trim().min(2, 'Informe o logradouro'),
  numero: z.string().trim().min(1, 'Informe o número'),
  bairro: z.string().trim().min(2, 'Informe o bairro'),
  cidade: z.string().trim().min(2, 'Informe a cidade'),
  uf: z.string().trim().length(2, 'UF deve ter 2 letras'),
  telefone: z.string().trim().min(8, 'Telefone inválido'),
  email: z.string().trim().email('E-mail inválido'),
  farmaceuticoResponsavel: z.string().trim().min(2, 'Informe o farmacêutico responsável'),
  crf: z.string().trim().min(2, 'Informe o CRF'),
  whatsappNumber: z.string().trim().min(10, 'WhatsApp inválido (com DDD)'),
})
export type CadastroInput = z.infer<typeof cadastroSchema>

export async function salvarCadastro(input: CadastroInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const pharmacyId = await getCurrentPharmacyId()
  const parsed = cadastroSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Preencha todos os campos obrigatórios.' }
  }
  const d = parsed.data
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
    const msg = e instanceof Error && e.message.includes('Configuração do servidor')
      ? e.message
      : 'Não foi possível salvar. Verifique a conexão e a configuração do servidor e tente de novo.'
    return { ok: false, error: msg }
  }
  revalidatePath('/painel')
  return { ok: true }
}
