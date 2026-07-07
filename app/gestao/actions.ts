'use server'
import { z } from 'zod'
import { requireSuperadmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const db = createAdminClient()

  const { data: exist } = await db.from('pharmacies').select('id').eq('slug', d.slug).maybeSingle()
  if (exist) return { ok: false, error: 'Já existe uma farmácia com esse slug.' }

  const { data: ph, error } = await db
    .from('pharmacies')
    .insert({ slug: d.slug, nome_fantasia: d.nomeFantasia, nome_exibicao: d.nomeFantasia, status: 'active', onboarding_completed: false })
    .select('id')
    .single()
  if (error || !ph) return { ok: false, error: error?.message ?? 'Falha ao criar farmácia' }

  const { data: created, error: uErr } = await db.auth.admin.createUser({
    email: d.emailAdmin,
    password: d.senhaAdmin,
    email_confirm: true,
  })
  if (uErr || !created?.user) {
    await db.from('pharmacies').delete().eq('id', ph.id)
    return { ok: false, error: uErr?.message ?? 'Falha ao criar o login da farmácia' }
  }

  const { error: pErr } = await db.from('profiles').insert({ id: created.user.id, pharmacy_id: ph.id, role: 'pharmacy_admin' })
  if (pErr) {
    await db.auth.admin.deleteUser(created.user.id)
    await db.from('pharmacies').delete().eq('id', ph.id)
    return { ok: false, error: pErr.message }
  }

  revalidatePath('/gestao')
  return { ok: true, pharmacyId: ph.id }
}

export async function alternarStatus(pharmacyId: string, status: 'active' | 'suspended'): Promise<void> {
  await requireSuperadmin()
  const db = createAdminClient()
  await db.from('pharmacies').update({ status, updated_at: new Date().toISOString() }).eq('id', pharmacyId)
  revalidatePath('/gestao')
}
