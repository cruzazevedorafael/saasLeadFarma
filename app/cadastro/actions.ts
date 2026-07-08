'use server'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionPharmacy } from '@/lib/data/pharmacy-provisioning'

const schema = z.object({
  nomeFantasia: z.string().trim().min(2, 'Informe o nome da farmácia'),
  emailAdmin: z.string().trim().email('E-mail inválido'),
  senhaAdmin: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
  whatsapp: z.string().trim().optional().default(''),
})

export type AutoCadastroInput = z.infer<typeof schema>

// slug a partir do nome (sem acento, minúsculo, hífen), único por sufixo numérico.
async function slugUnico(nome: string): Promise<string> {
  const base = nome.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'farmacia'
  const db = createAdminClient()
  let slug = base
  for (let i = 2; i < 50; i++) {
    const { data } = await db.from('pharmacies').select('id').eq('slug', slug).maybeSingle()
    if (!data) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}

export async function autoCadastro(input: AutoCadastroInput): Promise<{ ok: false; error: string }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  const d = parsed.data

  const slug = await slugUnico(d.nomeFantasia)
  const result = await provisionPharmacy({
    nomeFantasia: d.nomeFantasia,
    slug,
    emailAdmin: d.emailAdmin,
    senhaAdmin: d.senhaAdmin,
    whatsapp: d.whatsapp,
    plan: 'trial',
    trialDays: 14,
  })
  if (!result.ok) return { ok: false, error: result.error }

  // loga automaticamente (seta os cookies de sessão) e manda pro onboarding.
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email: d.emailAdmin, password: d.senhaAdmin })
  redirect('/painel/cadastro')
}
