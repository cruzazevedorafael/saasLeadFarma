// lib/data/platform.ts
// Métricas da plataforma para o painel de gestão (super-admin). service_role.
// Lê a view public.pharmacy_metrics (0010), que só o service_role enxerga.
import { createAdminClient } from '@/lib/supabase/admin'

export interface PharmacyMetricRow {
  id: string
  slug: string
  nome: string
  status: 'active' | 'suspended'
  plan: 'trial' | 'basic' | 'pro'
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled'
  onboardingCompleted: boolean
  trialEndsAt: string | null
  createdAt: string
  nPedidos: number
  nConcluidos: number
  faturamento: number
  nProdutos: number
}

export interface PlatformOverview {
  totalFarmacias: number
  ativas: number
  suspensas: number
  emTrial: number
  assinaturasAtivas: number
  pagamentoPendente: number
  onboardingPendente: number
  faturamentoAgregado: number
  totalPedidos: number
  totalProdutos: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(r: any): PharmacyMetricRow {
  return {
    id: r.id,
    slug: r.slug,
    nome: r.nome_exibicao ?? r.nome_fantasia ?? '—',
    status: r.status,
    plan: r.plan ?? 'trial',
    subscriptionStatus: r.subscription_status ?? 'trialing',
    onboardingCompleted: !!r.onboarding_completed,
    trialEndsAt: r.trial_ends_at ?? null,
    createdAt: r.created_at,
    nPedidos: Number(r.n_pedidos ?? 0),
    nConcluidos: Number(r.n_concluidos ?? 0),
    faturamento: Number(r.faturamento ?? 0),
    nProdutos: Number(r.n_produtos ?? 0),
  }
}

/** Todas as farmácias com suas métricas, ordenadas por faturamento desc. */
export async function getPharmaciesWithMetrics(): Promise<PharmacyMetricRow[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('pharmacy_metrics')
    .select('*')
    .order('faturamento', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

/** KPIs gerais da plataforma, agregados sobre a mesma lista (1 query). */
export function overviewFrom(rows: PharmacyMetricRow[]): PlatformOverview {
  const o: PlatformOverview = {
    totalFarmacias: rows.length,
    ativas: 0, suspensas: 0, emTrial: 0, assinaturasAtivas: 0, pagamentoPendente: 0,
    onboardingPendente: 0, faturamentoAgregado: 0, totalPedidos: 0, totalProdutos: 0,
  }
  for (const r of rows) {
    if (r.status === 'active') o.ativas++; else o.suspensas++
    if (r.subscriptionStatus === 'trialing') o.emTrial++
    if (r.subscriptionStatus === 'active') o.assinaturasAtivas++
    if (r.subscriptionStatus === 'past_due') o.pagamentoPendente++
    if (!r.onboardingCompleted) o.onboardingPendente++
    o.faturamentoAgregado += r.faturamento
    o.totalPedidos += r.nPedidos
    o.totalProdutos += r.nProdutos
  }
  return o
}
