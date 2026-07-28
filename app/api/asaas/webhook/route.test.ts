import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

let insertError: any = null
let insertedEvents: any[] = []
let updateCalls: any[] = []
let updateError: any = null
let deletedEvents: any[] = []
let deleteError: any = null

function fakeDb() {
  return {
    from(table: string) {
      if (table === 'asaas_webhook_events') {
        return {
          insert: async (row: any) => { insertedEvents.push(row); return { error: insertError } },
          delete: () => ({
            eq: async (col: string, val: string) => { deletedEvents.push({ col, val }); return { error: deleteError } },
          }),
        }
      }
      if (table === 'pharmacies') {
        return {
          update: (patch: any) => ({
            eq: async (col: string, val: string) => { updateCalls.push({ patch, col, val }); return { error: updateError } },
          }),
        }
      }
      throw new Error(`tabela inesperada: ${table}`)
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))

function req(body: any, token?: string) {
  return new Request('http://localhost/api/asaas/webhook', {
    method: 'POST',
    headers: token ? { 'asaas-access-token': token } : {},
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  insertError = null
  insertedEvents = []
  updateCalls = []
  updateError = null
  deletedEvents = []
  deleteError = null
  captureExceptionMock.mockClear()
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'segredo-teste')
})

describe('POST /api/asaas/webhook', () => {
  it('sem ASAAS_WEBHOOK_TOKEN configurado: recusa com 500 (fail-closed)', async () => {
    vi.stubEnv('ASAAS_WEBHOOK_TOKEN', '')
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED' }, 'qualquer'))
    expect(r.status).toBe(500)
  })

  it('token ausente: 401', async () => {
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED' }))
    expect(r.status).toBe(401)
  })

  it('token errado: 401', async () => {
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED' }, 'errado'))
    expect(r.status).toBe(401)
  })

  it('token certo, evento válido: atualiza a farmácia e responde 200', async () => {
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls).toEqual([{ patch: expect.objectContaining({ subscription_status: 'active' }), col: 'asaas_customer_id', val: 'cus_1' }])
    expect(insertedEvents).toEqual([{ event_id: 'evt1' }])
  })

  it('evento repetido (event_id já visto): não reprocessa, responde 200', async () => {
    insertError = { code: '23505', message: 'duplicate key' }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls).toHaveLength(0)
  })

  it('falha ao atualizar farmácia: desfaz o dedup e responde 500 (para o ASAAS reenviar)', async () => {
    updateError = { code: 'XXYYZ', message: 'erro transitório de rede' }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(500)
    expect(insertedEvents).toEqual([{ event_id: 'evt1' }])
    expect(deletedEvents).toEqual([{ col: 'event_id', val: 'evt1' }])
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    const [err, ctx] = captureExceptionMock.mock.calls[0]
    expect(ctx.extra).toMatchObject({ eventId: 'evt1' })
  })

  it('JSON inválido: 400', async () => {
    const badReq = new Request('http://localhost/api/asaas/webhook', {
      method: 'POST',
      headers: { 'asaas-access-token': 'segredo-teste' },
      body: '{not json',
    })
    const r = await POST(badReq)
    expect(r.status).toBe(400)
  })
})
