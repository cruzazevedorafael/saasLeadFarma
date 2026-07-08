// lib/data/pharmacy-provisioning.ts
// Criação de uma farmácia + login admin, num passo atômico (desfaz em falha).
// Usado tanto pela Gestão (superadmin) quanto pelo auto-cadastro público.
import { createAdminClient } from '@/lib/supabase/admin'

export interface ProvisionInput {
  nomeFantasia: string
  slug: string
  emailAdmin: string
  senhaAdmin: string
  whatsapp?: string
  plan?: 'trial' | 'basic' | 'pro'
  trialDays?: number
}

export type ProvisionResult =
  | { ok: true; pharmacyId: string }
  | { ok: false; error: string }

export async function provisionPharmacy(input: ProvisionInput): Promise<ProvisionResult> {
  const db = createAdminClient()

  const { data: exist } = await db.from('pharmacies').select('id').eq('slug', input.slug).maybeSingle()
  if (exist) return { ok: false, error: 'Já existe uma farmácia com esse endereço (slug).' }

  const plan = input.plan ?? 'trial'
  const status = plan === 'trial' ? 'trialing' : 'active'
  const trialEndsAt = plan === 'trial'
    ? new Date(Date.now() + (input.trialDays ?? 14) * 86400_000).toISOString()
    : null

  const { data: ph, error } = await db
    .from('pharmacies')
    .insert({
      slug: input.slug,
      nome_fantasia: input.nomeFantasia,
      nome_exibicao: input.nomeFantasia,
      whatsapp_number: input.whatsapp ?? '',
      status: 'active',
      onboarding_completed: false,
      plan,
      subscription_status: status,
      trial_ends_at: trialEndsAt,
    })
    .select('id')
    .single()
  if (error || !ph) return { ok: false, error: error?.message ?? 'Falha ao criar farmácia' }

  const { data: created, error: uErr } = await db.auth.admin.createUser({
    email: input.emailAdmin,
    password: input.senhaAdmin,
    email_confirm: true,
  })
  if (uErr || !created?.user) {
    await db.from('pharmacies').delete().eq('id', ph.id)
    const already = uErr?.message?.toLowerCase().includes('already')
    return { ok: false, error: already ? 'Este e-mail já tem um cadastro.' : (uErr?.message ?? 'Falha ao criar o login') }
  }

  const { error: pErr } = await db.from('profiles').insert({ id: created.user.id, pharmacy_id: ph.id, role: 'pharmacy_admin' })
  if (pErr) {
    await db.auth.admin.deleteUser(created.user.id)
    await db.from('pharmacies').delete().eq('id', ph.id)
    return { ok: false, error: pErr.message }
  }

  return { ok: true, pharmacyId: ph.id }
}
