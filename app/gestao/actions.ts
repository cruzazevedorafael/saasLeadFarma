'use server'
import { z } from 'zod'
import { requireSuperadmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionPharmacy } from '@/lib/data/pharmacy-provisioning'
import { revalidatePath } from 'next/cache'

const novaSchema = z.object({
  nomeFantasia: z.string().trim().min(2, 'Informe o nome da farmácia'),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido — use apenas letras minúsculas, números e hífen'),
  emailAdmin: z.string().trim().email('E-mail inválido'),
  senhaAdmin: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})
export type NovaFarmaciaInput = z.infer<typeof novaSchema>

export async function criarFarmacia(input: NovaFarmaciaInput): Promise<{ ok: true; pharmacyId: string } | { ok: false; error: string }> {
  await requireSuperadmin()
  const parsed = novaSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  const d = parsed.data

  // Farmácia criada pela Gestão já entra ativa (plano pro, sem período de teste).
  const result = await provisionPharmacy({
    nomeFantasia: d.nomeFantasia, slug: d.slug,
    emailAdmin: d.emailAdmin, senhaAdmin: d.senhaAdmin, plan: 'pro',
  })
  if (!result.ok) return result

  revalidatePath('/gestao')
  return { ok: true, pharmacyId: result.pharmacyId }
}

export async function alternarStatus(pharmacyId: string, status: 'active' | 'suspended'): Promise<void> {
  await requireSuperadmin()
  const db = createAdminClient()
  await db.from('pharmacies').update({ status, updated_at: new Date().toISOString() }).eq('id', pharmacyId)
  revalidatePath('/gestao')
}

// ------------------------------------------------------------
// Edição completa dos dados cadastrais de uma farmácia (super-admin).
// Campos editáveis: cadastro legal + marca (nome_exibicao) + operação
// (whatsapp_number, wholesale_threshold). Slug/plano/status não entram aqui.
// ------------------------------------------------------------
const opt = z.string().trim().max(200).optional()
const editarSchema = z.object({
  razao_social: opt,
  nome_fantasia: opt,
  nome_exibicao: opt,
  cnpj: opt,
  cep: opt,
  logradouro: opt,
  numero: z.string().trim().max(20).optional(),
  bairro: opt,
  cidade: opt,
  uf: z.string().trim().max(2).optional(),
  telefone: opt,
  email: z.union([z.string().trim().email('E-mail inválido'), z.literal('')]).optional(),
  farmaceutico_responsavel: opt,
  crf: opt,
  whatsapp_number: opt,
  wholesale_threshold: z.coerce.number().int().min(1, 'Mínimo 1').max(999).optional(),
})
export type EditarFarmaciaInput = z.infer<typeof editarSchema>

export async function editarFarmacia(
  id: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin()
  const parsed = editarSchema.safeParse(patch)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  try {
    const db = createAdminClient()
    const { error } = await db
      .from('pharmacies')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao salvar' }
  }

  revalidatePath('/gestao')
  revalidatePath('/gestao/' + id)
  return { ok: true }
}

// ------------------------------------------------------------
// Exclusão irreversível de uma farmácia (super-admin).
// Apaga os usuários de login (auth.users) via Auth Admin API — que não caem
// por cascade — e depois a linha da farmácia (o cascade nas FKs pharmacy_id
// remove produtos, pedidos, clientes, perfis etc.).
// ------------------------------------------------------------
export async function excluirFarmacia(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin()
  try {
    const db = createAdminClient()

    // 1) usuários de login ligados à farmácia
    const { data: profiles, error: profErr } = await db
      .from('profiles')
      .select('id')
      .eq('pharmacy_id', id)
    if (profErr) return { ok: false, error: profErr.message }

    // 2) apaga cada usuário no Auth (perfil cai por cascade em auth.users)
    for (const p of profiles ?? []) {
      const { error: delErr } = await db.auth.admin.deleteUser(p.id)
      // "user not found" não deve travar a exclusão da farmácia
      if (delErr && !/not.?found/i.test(delErr.message)) {
        return { ok: false, error: `Falha ao remover usuário: ${delErr.message}` }
      }
    }

    // 3) apaga a farmácia (cascade cuida das tabelas de negócio)
    const { error: phErr } = await db.from('pharmacies').delete().eq('id', id)
    if (phErr) return { ok: false, error: phErr.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao excluir' }
  }

  revalidatePath('/gestao')
  return { ok: true }
}
