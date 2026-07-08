// lib/asaas/billing.ts — cria cliente + assinatura no ASAAS para uma farmácia.
// Tudo passa por asaasFetch, que devolve {ok:false} quando a integração está
// desligada (sem chave) — então nada quebra em modo manual/teste.
import { asaasFetch, asaasEnabled } from './client'
import { PLANS, type PlanId } from './plans'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPharmacyById } from '@/lib/data/pharmacy'

export type BillingResult =
  | { ok: true; invoiceUrl?: string; subscriptionId?: string }
  | { ok: false; error: string }

// Garante um customer no ASAAS para a farmácia (idempotente via asaas_customer_id).
async function ensureCustomer(pharmacyId: string): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const ph = await getPharmacyById(pharmacyId)
  if (!ph) return { ok: false, error: 'Farmácia não encontrada' }
  if (ph.asaasCustomerId) return { ok: true, customerId: ph.asaasCustomerId }

  const r = await asaasFetch<{ id: string }>('/customers', {
    method: 'POST',
    body: {
      name: ph.razaoSocial || ph.nomeFantasia || ph.nomeExibicao,
      cpfCnpj: (ph.cnpj || '').replace(/\D/g, '') || undefined,
      email: ph.email || undefined,
      phone: (ph.telefone || ph.whatsappNumber || '').replace(/\D/g, '') || undefined,
    },
  })
  if (!r.ok || !r.data?.id) return { ok: false, error: r.error ?? 'Falha ao criar cliente no ASAAS' }

  const db = createAdminClient()
  await db.from('pharmacies').update({ asaas_customer_id: r.data.id }).eq('id', pharmacyId)
  return { ok: true, customerId: r.data.id }
}

// Cria a assinatura mensal do plano escolhido e devolve o link da 1ª cobrança.
export async function subscribePharmacy(pharmacyId: string, plan: Exclude<PlanId, 'trial'>): Promise<BillingResult> {
  if (!asaasEnabled()) return { ok: false, error: 'Cobrança ainda não ativada (ASAAS pendente de credenciais).' }
  const cust = await ensureCustomer(pharmacyId)
  if (!cust.ok) return cust

  const p = PLANS[plan]
  const nextDue = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10) // vence em 3 dias
  const sub = await asaasFetch<{ id: string }>('/subscriptions', {
    method: 'POST',
    body: {
      customer: cust.customerId,
      billingType: 'UNDEFINED', // cliente escolhe (Pix/boleto/cartão)
      value: p.priceMonthly,
      nextDueDate: nextDue,
      cycle: 'MONTHLY',
      description: `LeadFarma — plano ${p.name}`,
    },
  })
  if (!sub.ok || !sub.data?.id) return { ok: false, error: sub.error ?? 'Falha ao criar assinatura' }

  const db = createAdminClient()
  await db.from('pharmacies').update({
    asaas_subscription_id: sub.data.id, plan, subscription_status: 'past_due',
  }).eq('id', pharmacyId)

  // link da primeira fatura (para o cliente pagar)
  const invoices = await asaasFetch<{ data: { invoiceUrl: string }[] }>(`/subscriptions/${sub.data.id}/payments`)
  const invoiceUrl = invoices.ok ? invoices.data?.data?.[0]?.invoiceUrl : undefined
  return { ok: true, subscriptionId: sub.data.id, invoiceUrl }
}
