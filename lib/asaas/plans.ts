// lib/asaas/plans.ts — catálogo de planos do LeadFarma.
export type PlanId = 'trial' | 'basic' | 'pro'

export interface Plan {
  id: PlanId
  name: string
  priceMonthly: number // em reais
  description: string
  features: string[]
}

export const PLANS: Record<Exclude<PlanId, 'trial'>, Plan> = {
  basic: {
    id: 'basic',
    name: 'Essencial',
    priceMonthly: 49.9,
    description: 'Catálogo, pedidos por WhatsApp e comprovantes.',
    features: ['Catálogo instalável (PWA)', 'Pedidos e clientes', 'Comprovante A4 e cupom 58mm'],
  },
  pro: {
    id: 'pro',
    name: 'Profissional',
    priceMonthly: 99.9,
    description: 'Tudo do Essencial + relatórios e prioridade.',
    features: ['Tudo do Essencial', 'Relatórios de vendas', 'Suporte prioritário'],
  },
}

export function planLabel(id: string): string {
  if (id === 'trial') return 'Teste grátis'
  return PLANS[(id as 'basic' | 'pro')]?.name ?? id
}

export function subscriptionLabel(status: string): string {
  return (
    {
      trialing: 'Em teste',
      active: 'Ativa',
      past_due: 'Pagamento pendente',
      canceled: 'Cancelada',
    } as Record<string, string>
  )[status] ?? status
}
