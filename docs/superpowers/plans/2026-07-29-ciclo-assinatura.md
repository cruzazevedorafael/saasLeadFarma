# Ciclo de Vida de Assinatura Automático (Bloco 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o LeadFarma suspender automaticamente uma farmácia com trial vencido (na hora) ou pagamento atrasado (após 3 dias de tolerância), e reativar sozinho quando o pagamento confirma — sem depender de alguém clicar manualmente em `/gestao`.

**Architecture:** Uma migration nova rastreia a origem da suspensão (`suspension_reason`) e quando `subscription_status` mudou pela última vez (`subscription_status_since`, mais confiável que `updated_at`). Um cron diário (Vercel Cron, autenticado por `CRON_SECRET`) suspende farmácias vencidas. O webhook do Asaas (já existente, Bloco 1) ganha lógica de reativação automática — só quando a suspensão foi automática, nunca quando foi manual.

**Tech Stack:** Next.js 16 (App Router, Route Handlers) + Supabase + Vercel Cron + Vitest.

## Global Constraints

- Migrations aplicadas com `node scripts/apply-migration.mjs supabase/migrations/<arquivo>.sql`.
- Toda escrita em `pharmacies` a partir de código automatizado (cron, webhook) usa `createAdminClient()` (service_role) — nunca a sessão do usuário.
- `CRON_SECRET`/`ASAAS_WEBHOOK_TOKEN`: comparação de token sempre via `timingSafeEqual`, fail-closed (sem a env var configurada, recusa tudo com 500) — mesmo padrão já estabelecido no Bloco 1.
- Reativação automática só quando `suspension_reason` é `'trial_expired'` ou `'payment_overdue'` — nunca quando é `null` (suspensão manual/outro motivo).
- Todo teste novo segue o padrão de banco fake já usado no repo (mock de `@/lib/supabase/admin` via `vi.mock`) — não bater em serviço real.
- Rodar `npx vitest run` e `pnpm build` no fim de cada tarefa antes de commitar.

---

## Task 1: Migration — `subscription_status_since` + `suspension_reason`

**Files:**
- Create: `supabase/migrations/0018_ciclo_assinatura.sql`

**Interfaces:**
- Produces: colunas `pharmacies.subscription_status_since` (timestamptz) e `pharmacies.suspension_reason` (text, nullable, check `in ('trial_expired','payment_overdue')` quando não nulo) — consumidas pelas Tasks 2-4.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0018_ciclo_assinatura.sql
-- Ciclo de vida de assinatura automático: rastreia a origem da suspensão (pra
-- saber se pode reativar sozinha) e quando subscription_status mudou pela
-- última vez (relógio confiável pra contar a tolerância de atraso — updated_at
-- muda por qualquer edição da farmácia, não serve pra isso).
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0018_ciclo_assinatura.sql

alter table public.pharmacies add column if not exists subscription_status_since timestamptz not null default now();
alter table public.pharmacies add column if not exists suspension_reason text
  check (suspension_reason is null or suspension_reason in ('trial_expired', 'payment_overdue'));

-- Redefine o guard de 0009 incluindo as duas colunas novas na lista de campos
-- que authenticated (farmácia) não pode alterar via console — mesma proteção
-- que já vale pra plan/subscription_status/trial_ends_at/status/slug.
create or replace function public.pharmacies_guard_sensitive_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_claim text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  if role_claim <> 'authenticated' or public.is_superadmin() then
    return new;
  end if;

  if new.plan               is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.status             is distinct from old.status
     or new.trial_ends_at      is distinct from old.trial_ends_at
     or new.asaas_customer_id  is distinct from old.asaas_customer_id
     or new.asaas_subscription_id is distinct from old.asaas_subscription_id
     or new.slug               is distinct from old.slug
     or new.subscription_status_since is distinct from old.subscription_status_since
     or new.suspension_reason  is distinct from old.suspension_reason
  then
    raise exception 'Campos de plano, assinatura, status e slug são gerenciados pela plataforma.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar a migration**

```bash
node scripts/apply-migration.mjs supabase/migrations/0018_ciclo_assinatura.sql
```
Expected: `✅ Migrações aplicadas`.

- [ ] **Step 3: Verificar as colunas no banco**

```bash
node -e "
const env = {}
for (const line of require('fs').readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*\$/)
  if (m) env[m[1]] = m[2]
}
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]
fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: \"select column_name, data_type, is_nullable from information_schema.columns where table_name = 'pharmacies' and column_name in ('subscription_status_since','suspension_reason')\" }),
}).then(r => r.json()).then(rows => console.log(JSON.stringify(rows, null, 2)))
"
```
Expected: 2 linhas, `subscription_status_since` (`timestamp with time zone`, `NO`) e `suspension_reason` (`text`, `YES`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_ciclo_assinatura.sql
git commit -m "feat(assinatura): adiciona subscription_status_since e suspension_reason"
```

---

## Task 2: `subscribePharmacy` e `alternarStatus` — pequenos ajustes

**Files:**
- Modify: `lib/asaas/billing.ts`
- Modify: `app/gestao/actions.ts`
- Create: `app/gestao/actions.test.ts`

**Interfaces:**
- Consumes: colunas da Task 1.

- [ ] **Step 1: `lib/asaas/billing.ts` — gravar `subscription_status_since` ao criar assinatura**

Trocar:
```typescript
  const db = createAdminClient()
  await db.from('pharmacies').update({
    asaas_subscription_id: sub.data.id, plan, subscription_status: 'past_due',
  }).eq('id', pharmacyId)
```
por:
```typescript
  const db = createAdminClient()
  await db.from('pharmacies').update({
    asaas_subscription_id: sub.data.id, plan, subscription_status: 'past_due',
    subscription_status_since: new Date().toISOString(),
  }).eq('id', pharmacyId)
```

- [ ] **Step 2: Escrever o teste de `alternarStatus` (falha primeiro)**

```typescript
// app/gestao/actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { alternarStatus } from './actions'

vi.mock('@/lib/auth/guards', () => ({ requireSuperadmin: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let updateCalls: { patch: any; id: string }[] = []

function fakeDb() {
  return {
    from(table: string) {
      if (table !== 'pharmacies') throw new Error(`tabela inesperada: ${table}`)
      return {
        update: (patch: any) => ({
          eq: async (_col: string, id: string) => { updateCalls.push({ patch, id }); return { error: null } },
        }),
      }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))

beforeEach(() => {
  updateCalls = []
})

describe('alternarStatus', () => {
  it('suspender: não mexe em suspension_reason (mantém o que já tinha, provavelmente definido por outro fluxo)', async () => {
    await alternarStatus('ph1', 'suspended')
    expect(updateCalls[0].patch.suspension_reason).toBeUndefined()
    expect(updateCalls[0].patch.status).toBe('suspended')
  })

  it('reativar: limpa suspension_reason (não deixa um motivo antigo "grudado" numa farmácia já reativada)', async () => {
    await alternarStatus('ph1', 'active')
    expect(updateCalls[0].patch).toMatchObject({ status: 'active', suspension_reason: null })
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/gestao/actions.test.ts`
Expected: FAIL no segundo teste — hoje `alternarStatus` não limpa `suspension_reason`.

- [ ] **Step 4: Implementar em `app/gestao/actions.ts`**

Trocar:
```typescript
export async function alternarStatus(pharmacyId: string, status: 'active' | 'suspended'): Promise<void> {
  await requireSuperadmin()
  const db = createAdminClient()
  await db.from('pharmacies').update({ status, updated_at: new Date().toISOString() }).eq('id', pharmacyId)
  revalidatePath('/gestao')
}
```
por:
```typescript
export async function alternarStatus(pharmacyId: string, status: 'active' | 'suspended'): Promise<void> {
  await requireSuperadmin()
  const db = createAdminClient()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'active') patch.suspension_reason = null
  await db.from('pharmacies').update(patch).eq('id', pharmacyId)
  revalidatePath('/gestao')
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/gestao/actions.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Rodar a suíte inteira e o build**

Run: `npx vitest run && pnpm build`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add lib/asaas/billing.ts app/gestao/actions.ts app/gestao/actions.test.ts
git commit -m "feat(assinatura): grava subscription_status_since e limpa suspension_reason ao reativar"
```

---

## Task 3: Webhook do Asaas — reativação automática

**Files:**
- Modify: `app/api/asaas/webhook/route.ts`
- Modify: `app/api/asaas/webhook/route.test.ts`

**Interfaces:**
- Consumes: colunas da Task 1.

- [ ] **Step 1: Reescrever o teste inteiro (falha primeiro)**

Substituir todo o conteúdo de `app/api/asaas/webhook/route.test.ts`:

```typescript
// app/api/asaas/webhook/route.test.ts
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
let selectResult: { data: any; error: any } = { data: { id: 'ph1', status: 'active', suspension_reason: null }, error: null }

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
          select: () => ({
            eq: () => ({ single: async () => selectResult }),
          }),
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
  selectResult = { data: { id: 'ph1', status: 'active', suspension_reason: null }, error: null }
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

  it('token certo, evento válido, farmácia ativa: atualiza subscription_status (sem mexer em status) e responde 200', async () => {
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls).toEqual([{
      patch: expect.objectContaining({ subscription_status: 'active' }),
      col: 'id', val: 'ph1',
    }])
    expect(updateCalls[0].patch.status).toBeUndefined()
    expect(insertedEvents).toEqual([{ event_id: 'evt1' }])
  })

  it('pagamento confirmado, farmácia suspensa por payment_overdue: reativa automaticamente', async () => {
    selectResult = { data: { id: 'ph1', status: 'suspended', suspension_reason: 'payment_overdue' }, error: null }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls[0].patch).toMatchObject({ subscription_status: 'active', status: 'active', suspension_reason: null })
  })

  it('pagamento confirmado, farmácia suspensa por trial_expired: reativa automaticamente', async () => {
    selectResult = { data: { id: 'ph1', status: 'suspended', suspension_reason: 'trial_expired' }, error: null }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls[0].patch).toMatchObject({ subscription_status: 'active', status: 'active', suspension_reason: null })
  })

  it('pagamento confirmado, farmácia suspensa MANUALMENTE (suspension_reason null): NÃO reativa sozinha', async () => {
    selectResult = { data: { id: 'ph1', status: 'suspended', suspension_reason: null }, error: null }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls[0].patch.status).toBeUndefined()
    expect(updateCalls[0].patch.suspension_reason).toBeUndefined()
  })

  it('evento de atraso (PAYMENT_OVERDUE) numa farmácia ativa: não reativa nem suspende (só grava subscription_status)', async () => {
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_OVERDUE', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls[0].patch).toMatchObject({ subscription_status: 'past_due' })
    expect(updateCalls[0].patch.status).toBeUndefined()
  })

  it('evento repetido (event_id já visto): não reprocessa, responde 200', async () => {
    insertError = { code: '23505', message: 'duplicate key' }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls).toHaveLength(0)
  })

  it('farmácia não encontrada pro evento: reporta pro Sentry e responde 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    selectResult = { data: null, error: null }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(500)
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
  })

  it('falha ao atualizar farmácia: desfaz o dedup e responde 500 (para o ASAAS reenviar)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    updateError = { code: 'XXYYZ', message: 'erro transitório de rede' }
    const r = await POST(req({ id: 'evt1', event: 'PAYMENT_CONFIRMED', payment: { customer: 'cus_1' } }, 'segredo-teste'))
    expect(r.status).toBe(500)
    expect(insertedEvents).toEqual([{ event_id: 'evt1' }])
    expect(deletedEvents).toEqual([{ col: 'event_id', val: 'evt1' }])
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    const [, ctx] = captureExceptionMock.mock.calls[0]
    expect(ctx.extra).toEqual({ eventId: 'evt1', subscriptionId: undefined, customerId: 'cus_1', status: 'active' })
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/api/asaas/webhook/route.test.ts`
Expected: FAIL em vários — o código atual ainda faz `update` direto por `asaas_subscription_id`/`asaas_customer_id` sem `select` prévio, então o mock de `select` nunca é usado e os testes de reativação/farmácia-não-encontrada falham.

- [ ] **Step 3: Reescrever `app/api/asaas/webhook/route.ts`**

```typescript
// app/api/asaas/webhook/route.ts — recebe eventos de cobrança do ASAAS.
// Fail-closed: sem ASAAS_WEBHOOK_TOKEN configurado, recusa TUDO (500) em vez
// de aceitar sem validar. Comparação de token com timingSafeEqual. Idempotente
// via asaas_webhook_events — evento repetido não reprocessa.
//
// Reativação automática: se o pagamento confirma (status vira 'active') e a
// farmácia estava suspensa por trial vencido ou atraso (suspension_reason
// preenchido pelo cron — ver app/api/cron/verificar-assinaturas), reativa
// sozinha. Suspensão manual (suspension_reason = null) nunca é mexida por
// aqui — só o superadmin reativa esse caso.
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

const AUTO_REACTIVATABLE_REASONS = new Set(['trial_expired', 'payment_overdue'])

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
    const selectQ = db.from('pharmacies').select('id, status, suspension_reason')
    const { data: ph, error: selErr } = subscriptionId
      ? await selectQ.eq('asaas_subscription_id', subscriptionId).single()
      : await selectQ.eq('asaas_customer_id', customerId!).single()

    if (selErr || !ph) {
      console.error('[asaas webhook] farmácia não encontrada para o evento:', selErr)
      Sentry.captureException(selErr ?? new Error('farmácia não encontrada'), { extra: { eventId, subscriptionId, customerId, status } })
      return new Response('internal error', { status: 500 })
    }

    const patch: Record<string, unknown> = {
      subscription_status: status,
      subscription_status_since: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const reactivating = status === 'active' && ph.status === 'suspended' && AUTO_REACTIVATABLE_REASONS.has(ph.suspension_reason)
    if (reactivating) {
      patch.status = 'active'
      patch.suspension_reason = null
    }

    const { error } = await db.from('pharmacies').update(patch).eq('id', ph.id)
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
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/api/asaas/webhook/route.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npx vitest run && pnpm build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add app/api/asaas/webhook/route.ts app/api/asaas/webhook/route.test.ts
git commit -m "feat(assinatura): webhook Asaas reativa automaticamente farmacia suspensa por trial/atraso"
```

---

## Task 4: Cron diário — suspender trial vencido e pagamento atrasado

**Files:**
- Create: `app/api/cron/verificar-assinaturas/route.ts`
- Create: `app/api/cron/verificar-assinaturas/route.test.ts`

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: `GET /api/cron/verificar-assinaturas` — consumido pelo agendamento da Task 5.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```typescript
// app/api/cron/verificar-assinaturas/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from './route'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

let selectCallCount = 0
let trialResult: { data: any[] | null; error: any }
let overdueResult: { data: any[] | null; error: any }
let updateCalls: { patch: any; id: string }[] = []
let updateError: any = null

function fakeDb() {
  return {
    from(table: string) {
      if (table !== 'pharmacies') throw new Error(`tabela inesperada: ${table}`)
      return {
        select: () => {
          selectCallCount += 1
          const result = selectCallCount === 1 ? trialResult : overdueResult
          const builder: any = {
            eq: () => builder,
            in: () => builder,
            not: () => builder,
            lt: () => builder,
            then: (resolve: any) => resolve(result),
          }
          return builder
        },
        update: (patch: any) => ({
          eq: async (_col: string, id: string) => {
            updateCalls.push({ patch, id })
            return { error: updateError }
          },
        }),
      }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))

function req(token?: string) {
  return new Request('http://localhost/api/cron/verificar-assinaturas', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  selectCallCount = 0
  trialResult = { data: [], error: null }
  overdueResult = { data: [], error: null }
  updateCalls = []
  updateError = null
  captureExceptionMock.mockClear()
  vi.stubEnv('CRON_SECRET', 'segredo-teste')
})

describe('GET /api/cron/verificar-assinaturas', () => {
  it('sem CRON_SECRET configurado: recusa com 500 (fail-closed)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const r = await GET(req('qualquer'))
    expect(r.status).toBe(500)
  })

  it('token ausente: 401', async () => {
    const r = await GET(req())
    expect(r.status).toBe(401)
  })

  it('token errado: 401', async () => {
    const r = await GET(req('errado'))
    expect(r.status).toBe(401)
  })

  it('token certo, nada pra suspender: responde ok com suspended: 0', async () => {
    const r = await GET(req('segredo-teste'))
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body).toEqual({ ok: true, suspended: 0 })
    expect(updateCalls).toHaveLength(0)
  })

  it('trial vencido: suspende com suspension_reason trial_expired', async () => {
    trialResult = { data: [{ id: 'ph1' }], error: null }
    const r = await GET(req('segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls).toEqual([
      { patch: expect.objectContaining({ status: 'suspended', suspension_reason: 'trial_expired' }), id: 'ph1' },
    ])
  })

  it('pagamento atrasado além da tolerância: suspende com suspension_reason payment_overdue', async () => {
    overdueResult = { data: [{ id: 'ph2' }], error: null }
    const r = await GET(req('segredo-teste'))
    expect(r.status).toBe(200)
    expect(updateCalls).toEqual([
      { patch: expect.objectContaining({ status: 'suspended', suspension_reason: 'payment_overdue' }), id: 'ph2' },
    ])
  })

  it('as duas listas ao mesmo tempo: suspende todas', async () => {
    trialResult = { data: [{ id: 'ph1' }], error: null }
    overdueResult = { data: [{ id: 'ph2' }], error: null }
    const r = await GET(req('segredo-teste'))
    const body = await r.json()
    expect(body.suspended).toBe(2)
    expect(updateCalls.map((c) => c.id)).toEqual(['ph1', 'ph2'])
  })

  it('erro na consulta: reporta pro Sentry e responde 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    trialResult = { data: null, error: { message: 'boom' } }
    const r = await GET(req('segredo-teste'))
    expect(r.status).toBe(500)
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
  })

  it('erro ao suspender uma farmácia específica: reporta pro Sentry mas não derruba a requisição inteira', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    trialResult = { data: [{ id: 'ph1' }], error: null }
    overdueResult = { data: [{ id: 'ph2' }], error: null }
    updateError = { message: 'falha ao atualizar' }
    const r = await GET(req('segredo-teste'))
    expect(r.status).toBe(200)
    expect(captureExceptionMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/api/cron/verificar-assinaturas/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implementar `app/api/cron/verificar-assinaturas/route.ts`**

```typescript
// app/api/cron/verificar-assinaturas/route.ts
// Roda 1x por dia (ver vercel.ts). Suspende farmácia com trial vencido (na
// hora) ou pagamento atrasado/cancelado há mais de GRACE_DAYS dias. Autenticado
// via CRON_SECRET (a Vercel manda Authorization: Bearer $CRON_SECRET
// automaticamente quando a env var existe) — fail-closed + comparação
// timing-safe, mesmo padrão do webhook do Asaas.
import { timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'

const GRACE_DAYS = 3

function tokensMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron verificar-assinaturas] CRON_SECRET não configurado — recusando (fail-closed).')
    return new Response('server misconfigured', { status: 500 })
  }
  const auth = req.headers.get('authorization') ?? ''
  const received = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!tokensMatch(received, expected)) return new Response('unauthorized', { status: 401 })

  const db = createAdminClient()
  const now = new Date()
  const graceLimit = new Date(now.getTime() - GRACE_DAYS * 86400_000).toISOString()

  try {
    const { data: trialExpirados, error: trialErr } = await db
      .from('pharmacies')
      .select('id')
      .eq('status', 'active')
      .eq('plan', 'trial')
      .not('trial_ends_at', 'is', null)
      .lt('trial_ends_at', now.toISOString())
    if (trialErr) throw trialErr

    const { data: pagamentoAtrasado, error: overdueErr } = await db
      .from('pharmacies')
      .select('id')
      .eq('status', 'active')
      .in('subscription_status', ['past_due', 'canceled'])
      .lt('subscription_status_since', graceLimit)
    if (overdueErr) throw overdueErr

    const suspensoes = [
      ...(trialExpirados ?? []).map((p: any) => ({ id: p.id, reason: 'trial_expired' as const })),
      ...(pagamentoAtrasado ?? []).map((p: any) => ({ id: p.id, reason: 'payment_overdue' as const })),
    ]

    for (const { id, reason } of suspensoes) {
      const { error } = await db
        .from('pharmacies')
        .update({ status: 'suspended', suspension_reason: reason, updated_at: now.toISOString() })
        .eq('id', id)
      if (error) {
        console.error(`[cron verificar-assinaturas] falha ao suspender ${id}:`, error)
        Sentry.captureException(error, { extra: { pharmacyId: id, reason } })
      }
    }

    console.log(`[cron verificar-assinaturas] ${suspensoes.length} farmácia(s) identificada(s) — ${trialExpirados?.length ?? 0} trial vencido, ${pagamentoAtrasado?.length ?? 0} pagamento atrasado.`)
    return Response.json({ ok: true, suspended: suspensoes.length })
  } catch (e) {
    console.error('[cron verificar-assinaturas] falha na verificação:', e)
    Sentry.captureException(e)
    return new Response('internal error', { status: 500 })
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/api/cron/verificar-assinaturas/route.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Rodar a suíte inteira e o build**

Run: `npx vitest run && pnpm build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/verificar-assinaturas/route.ts app/api/cron/verificar-assinaturas/route.test.ts
git commit -m "feat(assinatura): cron diario suspende trial vencido e pagamento atrasado (3 dias de tolerancia)"
```

---

## Task 5: Agendamento (Vercel Cron) + `.env.example`

**Files:**
- Create: `vercel.ts` (ou `vercel.json` como fallback — ver Step 1)
- Modify: `.env.example`

**Interfaces:** nenhuma — só configuração de plataforma.

- [ ] **Step 1: Tentar `vercel.ts` (formato atual recomendado)**

```bash
pnpm add -D @vercel/config
```

Se o pacote instalar sem erro, criar:
```typescript
// vercel.ts
import type { VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
  crons: [{ path: '/api/cron/verificar-assinaturas', schedule: '0 6 * * *' }],
}
```

**Se `pnpm add -D @vercel/config` falhar** (pacote não encontrado, ou versão incompatível com a CLI instalada — confirme com `vercel --version`, se for menor que a versão que introduziu suporte a `vercel.ts` isso é esperado), usar o formato clássico em vez disso:
```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/verificar-assinaturas", "schedule": "0 6 * * *" }]
}
```
Documentar no relatório qual dos dois caminhos foi usado e por quê.

- [ ] **Step 2: Confirmar que o arquivo tipa/valida corretamente**

Se usou `vercel.ts`: rodar `pnpm build` (o TypeScript do projeto deve aceitar o import de `@vercel/config/v1` sem erro — se der erro de tipo/módulo não encontrado, é sinal de trocar para `vercel.json`, voltar ao Step 1).
Se usou `vercel.json`: validar que é JSON sintaticamente correto (`node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` não deve lançar erro).

- [ ] **Step 3: Atualizar `.env.example`**

```
# Cron de verificação de assinatura (Vercel Cron injeta isso automaticamente
# como Authorization: Bearer $CRON_SECRET ao chamar a rota agendada)
CRON_SECRET=gere-um-token-aleatorio-forte-aqui
```

- [ ] **Step 4: Rodar a suíte inteira e o build**

Run: `npx vitest run && pnpm build`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add vercel.ts .env.example
# ou, se usou o fallback:
# git add vercel.json .env.example
git commit -m "feat(assinatura): agenda o cron de verificacao 1x por dia via Vercel Cron"
```

---

## Verificação final do Bloco 3

- [ ] `npx vitest run` — suíte inteira verde.
- [ ] `pnpm build` — build limpo.
- [ ] Depois de configurar `CRON_SECRET` na Vercel (passo do usuário — só ele tem acesso ao dashboard): disparar a rota manualmente (`curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/verificar-assinaturas`) e confirmar a resposta `{"ok":true,"suspended":N}`.
- [ ] Teste ponta a ponta manual: farmácia de teste com `trial_ends_at` no passado → rodar o cron → confirmar `status='suspended'`, `suspension_reason='trial_expired'` → simular webhook `PAYMENT_CONFIRMED` pra essa farmácia → confirmar que reativa sozinha.
- [ ] Confirmar que uma farmácia suspensa manualmente (via `/gestao`, `suspension_reason=null`) não é afetada por um webhook de pagamento confirmado simulado.
