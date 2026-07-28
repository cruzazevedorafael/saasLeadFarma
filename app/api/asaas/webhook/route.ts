// app/api/asaas/webhook/route.ts — recebe eventos de cobrança do ASAAS.
// Fail-closed: sem ASAAS_WEBHOOK_TOKEN configurado, recusa TUDO (500) em vez
// de aceitar sem validar. Comparação de token com timingSafeEqual. Idempotente
// via asaas_webhook_events — evento repetido não reprocessa.
//
// NOTA: o campo usado como id do evento (`body.id`) segue a documentação do
// Asaas na data desta implementação — confirme contra um payload real assim
// que a integração for ativada de verdade (ASAAS_API_KEY configurada).
import { timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

const EVENT_TO_STATUS: Record<string, 'active' | 'past_due' | 'canceled'> = {
  PAYMENT_CONFIRMED: 'active',
  PAYMENT_RECEIVED: 'active',
  PAYMENT_OVERDUE: 'past_due',
  PAYMENT_DELETED: 'canceled',
  PAYMENT_REFUNDED: 'canceled',
  SUBSCRIPTION_DELETED: 'canceled',
}

function tokensMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expected) {
    console.error('[asaas webhook] ASAAS_WEBHOOK_TOKEN não configurado — recusando requisição (fail-closed).')
    return new Response('server misconfigured', { status: 500 })
  }
  const token = req.headers.get('asaas-access-token') ?? ''
  if (!tokensMatch(token, expected)) return new Response('unauthorized', { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const db = createAdminClient()

  const eventId: string | undefined = body?.id
  let dedupRowInserted = false
  if (eventId) {
    const { error: insertError } = await db.from('asaas_webhook_events').insert({ event_id: eventId })
    if (insertError) {
      if (insertError.code === '23505') return new Response('ok', { status: 200 }) // já processado
      console.error('[asaas webhook] falha ao registrar evento (seguindo mesmo assim):', insertError)
    } else {
      dedupRowInserted = true
    }
  }

  const status = EVENT_TO_STATUS[body?.event as string]
  const subscriptionId: string | undefined = body?.payment?.subscription ?? body?.subscription?.id
  const customerId: string | undefined = body?.payment?.customer ?? body?.subscription?.customer

  if (status && (subscriptionId || customerId)) {
    const q = db.from('pharmacies').update({ subscription_status: status, updated_at: new Date().toISOString() })
    const { error } = subscriptionId
      ? await q.eq('asaas_subscription_id', subscriptionId)
      : await q.eq('asaas_customer_id', customerId!)
    if (error) {
      console.error('[asaas webhook] falha ao atualizar farmácia:', error)
      Sentry.captureException(error, { extra: { eventId, subscriptionId, customerId, status } })
      // A linha de dedup já foi gravada para este event_id. Se deixarmos assim, uma
      // futura reentrega do ASAAS vai bater no short-circuit de 23505 e nunca mais
      // tentar essa atualização — a mudança de status ficaria perdida para sempre.
      // Desfaz o "já visto" (best-effort) e responde 500 para o ASAAS reenviar depois.
      if (dedupRowInserted && eventId) {
        const { error: deleteError } = await db.from('asaas_webhook_events').delete().eq('event_id', eventId)
        if (deleteError) {
          console.error('[asaas webhook] falha ao desfazer dedup após erro de atualização (evento pode ficar perdido):', deleteError)
        }
      }
      return new Response('internal error', { status: 500 })
    }
  }

  // ASAAS espera 200 para não reenviar.
  return new Response('ok', { status: 200 })
}
