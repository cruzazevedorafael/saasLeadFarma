// app/api/asaas/webhook/route.ts — recebe eventos de cobrança do ASAAS.
// Valida o token (ASAAS_WEBHOOK_TOKEN) e atualiza subscription_status da farmácia.
// Enquanto a integração não estiver ativa, o endpoint responde 200 sem efeito.
import { createAdminClient } from '@/lib/supabase/admin'

const EVENT_TO_STATUS: Record<string, 'active' | 'past_due' | 'canceled'> = {
  PAYMENT_CONFIRMED: 'active',
  PAYMENT_RECEIVED: 'active',
  PAYMENT_OVERDUE: 'past_due',
  PAYMENT_DELETED: 'canceled',
  PAYMENT_REFUNDED: 'canceled',
  SUBSCRIPTION_DELETED: 'canceled',
}

export async function POST(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (expected) {
    const token = req.headers.get('asaas-access-token')
    if (token !== expected) return new Response('unauthorized', { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const status = EVENT_TO_STATUS[body?.event as string]
  const subscriptionId: string | undefined = body?.payment?.subscription ?? body?.subscription?.id
  const customerId: string | undefined = body?.payment?.customer ?? body?.subscription?.customer

  if (status && (subscriptionId || customerId)) {
    const db = createAdminClient()
    const q = db.from('pharmacies').update({ subscription_status: status, updated_at: new Date().toISOString() })
    if (subscriptionId) await q.eq('asaas_subscription_id', subscriptionId)
    else await q.eq('asaas_customer_id', customerId!)
  }

  // ASAAS espera 200 para não reenviar.
  return new Response('ok', { status: 200 })
}
