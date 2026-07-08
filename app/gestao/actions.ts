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
