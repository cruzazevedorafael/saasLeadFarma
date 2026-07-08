// lib/data/pharmacy.ts
// Data-layer da farmácia (o tenant). Substitui o antigo store_settings singleton.
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Pharmacy {
  id: string
  slug: string
  nomeExibicao: string
  logoUrl: string | null
  whatsappNumber: string
  bannerImageUrl: string
  wholesaleThreshold: number
  status: 'active' | 'suspended'
  onboardingCompleted: boolean
  // cadastro legal
  razaoSocial: string | null
  nomeFantasia: string | null
  cnpj: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  telefone: string | null
  email: string | null
  farmaceuticoResponsavel: string | null
  crf: string | null
  // planos / assinatura (Fase 5)
  plan: 'trial' | 'basic' | 'pro'
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled'
  trialEndsAt: string | null
  asaasCustomerId: string | null
  asaasSubscriptionId: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapPharmacyRow(r: any): Pharmacy {
  return {
    id: r.id,
    slug: r.slug,
    nomeExibicao: r.nome_exibicao ?? r.nome_fantasia ?? 'Farmácia',
    logoUrl: r.logo_url ?? null,
    whatsappNumber: r.whatsapp_number ?? '',
    bannerImageUrl: r.banner_image_url ?? '',
    wholesaleThreshold: Number(r.wholesale_threshold ?? 4),
    status: r.status,
    onboardingCompleted: !!r.onboarding_completed,
    razaoSocial: r.razao_social ?? null,
    nomeFantasia: r.nome_fantasia ?? null,
    cnpj: r.cnpj ?? null,
    cep: r.cep ?? null,
    logradouro: r.logradouro ?? null,
    numero: r.numero ?? null,
    bairro: r.bairro ?? null,
    cidade: r.cidade ?? null,
    uf: r.uf ?? null,
    telefone: r.telefone ?? null,
    email: r.email ?? null,
    farmaceuticoResponsavel: r.farmaceutico_responsavel ?? null,
    crf: r.crf ?? null,
    plan: r.plan ?? 'trial',
    subscriptionStatus: r.subscription_status ?? 'trialing',
    trialEndsAt: r.trial_ends_at ?? null,
    asaasCustomerId: r.asaas_customer_id ?? null,
    asaasSubscriptionId: r.asaas_subscription_id ?? null,
  }
}

/** Público (anon): resolve a farmácia ativa pelo slug da URL. null se inexistente/suspensa. */
export async function getPharmacyBySlug(slug: string): Promise<Pharmacy | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('pharmacies')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()
  if (error || !data) return null
  return mapPharmacyRow(data)
}

/** Server (service-role): farmácia por id, sem RLS. */
export async function getPharmacyById(id: string): Promise<Pharmacy | null> {
  const db = createAdminClient()
  const { data, error } = await db.from('pharmacies').select('*').eq('id', id).single()
  if (error || !data) return null
  return mapPharmacyRow(data)
}

/** Atualiza campos da farmácia (colunas em snake_case). */
export async function updatePharmacy(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = createAdminClient()
  const { error } = await db
    .from('pharmacies')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
