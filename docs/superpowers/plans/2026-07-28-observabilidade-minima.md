# Observabilidade Mínima (Bloco 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o LeadFarma avisar automaticamente (por e-mail, via Sentry) quando um pedido ou um webhook de pagamento falhar em produção, e mostrar telas de erro com a identidade visual da marca em vez da tela genérica do Next.js.

**Architecture:** SDK `@sentry/nextjs` com captura de erro só (sem tracing/replay), inerte até o DSN existir (não quebra nada enquanto o Sentry não for provisionado). Um filtro central (`lib/sentry-scrub.ts`) remove dado pessoal de cliente antes de qualquer evento sair do servidor. Dois pontos do código que já capturam a própria exceção (`criarPedido`, webhook Asaas) ganham uma chamada explícita a `Sentry.captureException` — o resto (erro não tratado em Server Component, etc.) o SDK já pega sozinho. Três `error.tsx`/`not-found.tsx` cobrem as áreas do site.

**Tech Stack:** Next.js 16 (App Router) + `@sentry/nextjs` (novo) + Vitest + Testing Library.

## Global Constraints

- Sentry só ativo em produção: `enabled: process.env.NODE_ENV === 'production'` em toda config de init.
- `tracesSampleRate: 0` — sem performance tracing nem Session Replay neste bloco.
- Nenhum dado pessoal de cliente (CPF, telefone, CEP, logradouro, número, complemento, bairro) pode sair do servidor rumo ao Sentry — sempre passar por `scrubPiiBeforeSend` antes do envio.
- Provisionar o Sentry em si (`vercel link` + `vercel integration add sentry`) exige login interativo — não é automatizável por um subagent. O código deste plano funciona corretamente (fica inerte, sem erro) mesmo antes desse provisionamento acontecer.
- Todo teste novo segue o padrão já usado no repo (Vitest + Testing Library pra componentes, mock de módulo via `vi.mock`).
- Rodar `npx vitest run` e `npm run build` no fim de cada tarefa antes de commitar.

---

## Task 1: Instalar e configurar o SDK do Sentry + filtro de PII

**Files:**
- Create: `lib/sentry-scrub.ts`
- Create: `lib/sentry-scrub.test.ts`
- Create: `instrumentation.ts` (raiz do projeto)
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `instrumentation-client.ts`
- Modify: `next.config.mjs`
- Modify: `.env.example`
- Modify: `package.json` (nova dependência)

**Interfaces:**
- Produces: `scrubPiiBeforeSend(event: any): any` — usado pelos 3 arquivos de config do Sentry (Task 1) e disponível como referência de padrão pras Tasks 2 e 3 (que não o chamam diretamente, só se apoiam no fato de que todo evento já passa por ele antes de sair).

- [ ] **Step 1: Provisionamento (passo do usuário, fora deste plano)**

Antes ou depois deste Task (não bloqueia o código): rodar `vercel link`, depois `vercel integration add sentry --yes`, depois `vercel env pull --yes` — isso popula `.env.local` com `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`. **Não é um step que o implementador executa** — precisa da conta Vercel/Sentry do usuário. O código dos steps seguintes funciona normalmente sem essas variáveis (fica inerte).

- [ ] **Step 2: Instalar a dependência**

```bash
pnpm add @sentry/nextjs
```

- [ ] **Step 3: Escrever o teste do filtro de PII (falha primeiro)**

```typescript
// lib/sentry-scrub.test.ts
import { describe, it, expect } from 'vitest'
import { scrubPiiBeforeSend } from './sentry-scrub'

describe('scrubPiiBeforeSend', () => {
  it('redige campos de PII em extra, mantendo o resto', () => {
    const event = {
      extra: {
        pharmacyId: 'ph1',
        orderId: 'o1',
        customer_cpf: '52998224725',
        customer_phone: '11988887777',
        customer_cep: '01310100',
        customer_logradouro: 'Av. Paulista',
        customer_numero: '1000',
        customer_complemento: 'Apto 1',
        customer_bairro: 'Bela Vista',
      },
    }
    const result = scrubPiiBeforeSend(event)
    expect(result.extra.pharmacyId).toBe('ph1')
    expect(result.extra.orderId).toBe('o1')
    expect(result.extra.customer_cpf).toBe('[redacted]')
    expect(result.extra.customer_phone).toBe('[redacted]')
    expect(result.extra.customer_cep).toBe('[redacted]')
    expect(result.extra.customer_logradouro).toBe('[redacted]')
    expect(result.extra.customer_numero).toBe('[redacted]')
    expect(result.extra.customer_complemento).toBe('[redacted]')
    expect(result.extra.customer_bairro).toBe('[redacted]')
  })

  it('redige PII aninhada dentro de request.data', () => {
    const event = {
      request: {
        data: { customerName: 'Maria', customer_cpf: '52998224725', items: [{ productId: 'p1' }] },
      },
    }
    const result = scrubPiiBeforeSend(event)
    expect(result.request.data.customerName).toBe('Maria')
    expect(result.request.data.customer_cpf).toBe('[redacted]')
    expect(result.request.data.items).toEqual([{ productId: 'p1' }])
  })

  it('evento sem extra/request/contexts/breadcrumbs: devolve como veio, sem quebrar', () => {
    const event = { message: 'algo quebrou' }
    expect(scrubPiiBeforeSend(event)).toEqual({ message: 'algo quebrou' })
  })

  it('redige PII dentro de breadcrumbs', () => {
    const event = {
      breadcrumbs: [{ message: 'clique', data: { cpf: '52998224725', action: 'submit' } }],
    }
    const result = scrubPiiBeforeSend(event)
    expect(result.breadcrumbs[0].data.cpf).toBe('[redacted]')
    expect(result.breadcrumbs[0].data.action).toBe('submit')
  })
})
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/sentry-scrub.test.ts`
Expected: FAIL — `Cannot find module './sentry-scrub'`.

- [ ] **Step 5: Implementar `lib/sentry-scrub.ts`**

```typescript
// lib/sentry-scrub.ts
// Remove dado pessoal de cliente antes de qualquer evento sair pro Sentry —
// CPF/telefone/endereço não têm por que sair do nosso servidor. O que sobra
// (pharmacy_id, order_id, stack trace) já basta pra debugar. Usado pelos três
// arquivos de config do Sentry (sentry.server.config.ts, sentry.edge.config.ts,
// instrumentation-client.ts).
const PII_KEYS = new Set([
  'customer_cpf', 'customer_phone', 'customer_cep', 'customer_logradouro',
  'customer_numero', 'customer_complemento', 'customer_bairro',
  'cpf', 'phone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro',
])

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubValue)
  if (value && typeof value === 'object') return scrubObject(value as Record<string, unknown>)
  return value
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    out[key] = PII_KEYS.has(key) ? '[redacted]' : scrubValue(value)
  }
  return out
}

export function scrubPiiBeforeSend(event: any): any {
  if (event.extra) event.extra = scrubObject(event.extra)
  if (event.contexts) event.contexts = scrubObject(event.contexts)
  if (event.request?.data) event.request.data = scrubObject(event.request.data)
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => ({
      ...b,
      data: b.data ? scrubObject(b.data) : b.data,
    }))
  }
  return event
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/sentry-scrub.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 7: Confirmar a convenção de arquivos da versão instalada do SDK**

A versão exata do `@sentry/nextjs` instalada pode esperar `instrumentation-client.ts` (convenção mais recente) ou `sentry.client.config.ts` (convenção anterior) para o lado do browser. Depois de instalar (Step 2), rodar:

```bash
cat node_modules/@sentry/nextjs/package.json | grep '"version"'
```

Se a versão for `>= 8.x` recente (verificar o CHANGELOG do pacote em `node_modules/@sentry/nextjs/CHANGELOG.md` se a dúvida persistir), use `instrumentation-client.ts` (Step 10 abaixo já assume essa convenção). Se o build (Step 11) reclamar ou avisar que esse arquivo não é reconhecido, trocar o nome do arquivo para `sentry.client.config.ts` — o conteúdo é idêntico, só o nome do arquivo muda.

- [ ] **Step 8: Criar `instrumentation.ts` na raiz do projeto**

```typescript
// instrumentation.ts
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
```

- [ ] **Step 9: Criar `sentry.server.config.ts` e `sentry.edge.config.ts`**

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'
import { scrubPiiBeforeSend } from './lib/sentry-scrub'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0,
  beforeSend: scrubPiiBeforeSend,
})
```

```typescript
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'
import { scrubPiiBeforeSend } from './lib/sentry-scrub'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0,
  beforeSend: scrubPiiBeforeSend,
})
```

- [ ] **Step 10: Criar `instrumentation-client.ts`**

```typescript
// instrumentation-client.ts
import * as Sentry from '@sentry/nextjs'
import { scrubPiiBeforeSend } from './lib/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0,
  beforeSend: scrubPiiBeforeSend,
})
```

(Se o Step 7 apontou pra convenção antiga, criar esse mesmo conteúdo em `sentry.client.config.ts` em vez de `instrumentation-client.ts`.)

- [ ] **Step 11: Envolver `next.config.mjs` com `withSentryConfig`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    // Fotos de produto/banner sobem por Server Action. O padrão do Next é 1MB,
    // o que faz fotos de celular falharem. Aumentamos a folga (a imagem ainda é
    // comprimida no navegador antes de subir — ver lib/compress-image.ts).
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
  async headers() {
    // no-cache SÓ nas áreas privadas (dados sensíveis, sempre frescos). O catálogo
    // público /f/[slug] fica de fora → pode ser cacheado por CDN + ISR (revalidate
    // na própria página), o que deixa o catálogo (o que o cliente mais acessa) rápido.
    return [
      {
        source: '/painel/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/gestao/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ]
  },
}

import { withSentryConfig } from '@sentry/nextjs'

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
})
```

(Manter o `export default nextConfig` original só se o `import`/`withSentryConfig` não puder ficar no topo do arquivo por alguma restrição de sintaxe ESM — no caso normal, o bloco acima substitui o `export default nextConfig` que já existe no arquivo.)

- [ ] **Step 12: Atualizar `.env.example`**

```
# Sentry (observabilidade) — Vercel Marketplace → Sentry → conectar ao projeto
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 13: Build**

Run: `pnpm build`
Expected: build limpo. Sem `SENTRY_AUTH_TOKEN` configurado, o plugin do Sentry deve avisar (não falhar) que não vai subir source maps — comportamento esperado antes do provisionamento.

- [ ] **Step 14: Commit**

```bash
git add lib/sentry-scrub.ts lib/sentry-scrub.test.ts instrumentation.ts sentry.server.config.ts sentry.edge.config.ts instrumentation-client.ts next.config.mjs .env.example package.json pnpm-lock.yaml
git commit -m "feat(observabilidade): instala e configura Sentry com filtro de PII"
```

---

## Task 2: Capturar explicitamente as falhas de `criarPedido` e do webhook Asaas

**Files:**
- Modify: `app/_actions/criar-pedido.ts`
- Modify: `app/api/asaas/webhook/route.ts`
- Modify: `app/_actions/criar-pedido.test.ts`
- Modify: `app/api/asaas/webhook/route.test.ts`

**Interfaces:**
- Consumes: `Sentry.captureException` de `@sentry/nextjs` (Task 1).

- [ ] **Step 1: Atualizar o teste de `criarPedido` (falha primeiro)**

Em `app/_actions/criar-pedido.test.ts`, adicionar ao topo (junto aos outros `vi.mock`):

```typescript
const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))
```

E adicionar ao `beforeEach` existente: `captureExceptionMock.mockClear()`.

Adicionar um novo teste dentro do `describe('criarPedido', ...)` existente:

```typescript
  it('erro de banco: reporta pro Sentry com pharmacyId, sem dado pessoal do cliente', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    productsError = { message: 'boom' }
    await criarPedido(pedido(1))
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    const [err, ctx] = captureExceptionMock.mock.calls[0]
    expect(err).toBe(productsError)
    expect(ctx).toEqual({ extra: { pharmacyId: 'ph1' } })
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: FAIL — `captureExceptionMock` nunca é chamado hoje.

- [ ] **Step 3: Implementar em `app/_actions/criar-pedido.ts`**

Adicionar o import no topo:
```typescript
import * as Sentry from '@sentry/nextjs'
```

Modificar o bloco `catch` de `criarPedido`:
```typescript
  try {
    return await registrarPedido(parsed.data)
  } catch (e) {
    console.error('[criarPedido] falha ao registrar pedido:', e)
    Sentry.captureException(e, { extra: { pharmacyId: parsed.data.pharmacyId } })
    return { ok: false, error: 'Não foi possível registrar o pedido. Verifique sua internet e tente de novo.' }
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: PASS (todos os testes, incluindo o novo).

- [ ] **Step 5: Atualizar o teste do webhook (falha primeiro)**

Em `app/api/asaas/webhook/route.test.ts`, adicionar ao topo:

```typescript
const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))
```

E `captureExceptionMock.mockClear()` no `beforeEach` existente.

No teste já existente `'falha ao atualizar farmácia: desfaz o dedup e responde 500...'`, adicionar as asserções:

```typescript
    expect(captureExceptionMock).toHaveBeenCalledTimes(1)
    const [err, ctx] = captureExceptionMock.mock.calls[0]
    expect(ctx.extra).toMatchObject({ eventId: 'evt1' })
```

- [ ] **Step 6: Rodar o teste e confirmar que o novo trecho falha**

Run: `npx vitest run app/api/asaas/webhook/route.test.ts`
Expected: FAIL nas duas novas asserções desse teste.

- [ ] **Step 7: Implementar em `app/api/asaas/webhook/route.ts`**

Adicionar o import no topo:
```typescript
import * as Sentry from '@sentry/nextjs'
```

No bloco de falha de `pharmacies.update` (dentro do `if (error) { ... }`), logo após o `console.error` existente:
```typescript
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
```

(Nenhum dos campos em `extra` — `eventId`, `subscriptionId`, `customerId`, `status` — é dado pessoal do cliente final; são identificadores do Asaas e o status calculado.)

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/api/asaas/webhook/route.test.ts`
Expected: PASS (todos os testes).

- [ ] **Step 9: Rodar a suíte inteira e o build**

Run: `npx vitest run && pnpm build`
Expected: tudo verde.

- [ ] **Step 10: Commit**

```bash
git add app/_actions/criar-pedido.ts app/api/asaas/webhook/route.ts app/_actions/criar-pedido.test.ts app/api/asaas/webhook/route.test.ts
git commit -m "feat(observabilidade): reporta falha de criarPedido e do webhook Asaas pro Sentry"
```

---

## Task 3: Telas de erro (`error.tsx` / `not-found.tsx`) nas 3 áreas

**Files:**
- Create: `app/error.tsx`
- Create: `app/not-found.tsx`
- Create: `app/f/[slug]/error.tsx`
- Create: `app/f/[slug]/not-found.tsx`
- Create: `app/painel/error.tsx`
- Create: `app/error.test.tsx`
- Create: `app/f/[slug]/error.test.tsx`
- Create: `app/painel/error.test.tsx`

**Interfaces:**
- Consumes: `Sentry.captureException` de `@sentry/nextjs` (Task 1). `Logo` de `@/components/brand/logo` (`<Logo size="lg" />`, aceita `className`).

- [ ] **Step 1: Escrever o teste de `app/error.tsx` (falha primeiro)**

```tsx
// app/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ErrorPage from './error'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

afterEach(() => {
  cleanup()
  captureExceptionMock.mockClear()
})

describe('app/error.tsx', () => {
  it('reporta o erro pro Sentry e mostra a mensagem amigável', () => {
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={() => {}} />)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
  })

  it('botão "Tentar de novo" chama reset', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('boom')} reset={reset} />)
    screen.getByText('Tentar de novo').click()
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/error.test.tsx`
Expected: FAIL — `Cannot find module './error'`.

- [ ] **Step 3: Implementar `app/error.tsx` e `app/not-found.tsx`**

```tsx
// app/error.tsx
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size="lg" />
      <h1 className="font-display text-2xl font-bold">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Não foi você — foi a gente. Já fomos avisados. Tente de novo em instantes.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-accent"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
```

```tsx
// app/not-found.tsx
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size="lg" />
      <h1 className="font-display text-2xl font-bold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        A página que você procura não existe ou foi movida.
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/error.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 5: Escrever o teste de `app/f/[slug]/error.tsx` (falha primeiro)**

```tsx
// app/f/[slug]/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ErrorPage from './error'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

afterEach(() => {
  cleanup()
  captureExceptionMock.mockClear()
})

describe('app/f/[slug]/error.tsx', () => {
  it('reporta o erro pro Sentry e mostra mensagem pro cliente final', () => {
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={() => {}} />)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
    expect(screen.getByText(/Não foi você/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `npx vitest run "app/f/[slug]/error.test.tsx"`
Expected: FAIL — `Cannot find module './error'`.

- [ ] **Step 7: Implementar `app/f/[slug]/error.tsx` e `app/f/[slug]/not-found.tsx`**

```tsx
// app/f/[slug]/error.tsx
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Logo } from '@/components/brand/logo'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size="lg" />
      <h1 className="font-display text-2xl font-bold">Ops, algo travou aqui</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Não foi você — foi a gente. Já fomos avisados. Tente de novo em instantes.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
      >
        Tentar de novo
      </button>
    </div>
  )
}
```

```tsx
// app/f/[slug]/not-found.tsx
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size="lg" />
      <h1 className="font-display text-2xl font-bold">Loja não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esse link de catálogo não existe ou não está mais ativo. Confira o link com a farmácia.
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `npx vitest run "app/f/[slug]/error.test.tsx"`
Expected: PASS.

- [ ] **Step 9: Escrever o teste de `app/painel/error.tsx` (falha primeiro)**

```tsx
// app/painel/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PainelError from './error'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

afterEach(() => {
  cleanup()
  captureExceptionMock.mockClear()
})

describe('app/painel/error.tsx', () => {
  it('reporta o erro pro Sentry e mostra mensagem pro time da farmácia', () => {
    const error = new Error('boom')
    render(<PainelError error={error} reset={() => {}} />)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
    expect(screen.getByText('Algo deu errado no painel')).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/painel/error.test.tsx`
Expected: FAIL — `Cannot find module './error'`.

- [ ] **Step 11: Implementar `app/painel/error.tsx`**

```tsx
// app/painel/error.tsx
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function PainelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-ink-foreground">
      <Logo size="lg" className="text-ink-foreground" />
      <h1 className="font-display text-2xl font-bold">Algo deu errado no painel</h1>
      <p className="max-w-sm text-sm text-ink-foreground/70">
        Já fomos avisados. Tente de novo — se continuar, fale com o suporte.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
        >
          Tentar de novo
        </button>
        <Link
          href="/painel"
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-ink-foreground transition hover:bg-white/10"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 12: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/painel/error.test.tsx`
Expected: PASS.

- [ ] **Step 13: Rodar a suíte inteira e o build**

Run: `npx vitest run && pnpm build`
Expected: tudo verde, incluindo os 19+ arquivos de teste já existentes.

- [ ] **Step 14: Verificação manual (documentar, não é possível automatizar num ambiente sem servidor)**

Rodar `pnpm dev`, forçar um erro em cada segmento (ex: lançar uma exceção temporária dentro de um Server Component de `/`, `/f/<slug>` e `/painel`) e confirmar visualmente que a tela certa aparece, com a identidade visual correta — depois reverter a exceção de teste.

- [ ] **Step 15: Commit**

```bash
git add app/error.tsx app/not-found.tsx "app/f/[slug]/error.tsx" "app/f/[slug]/not-found.tsx" app/painel/error.tsx app/error.test.tsx "app/f/[slug]/error.test.tsx" app/painel/error.test.tsx
git commit -m "feat(observabilidade): error.tsx/not-found.tsx com a identidade do LeadFarma nas 3 areas principais"
```

---

## Verificação final do Bloco 2

- [ ] `npx vitest run` — suíte inteira verde.
- [ ] `pnpm build` — build limpo.
- [ ] Confirmar que `criarPedido` e o webhook continuam funcionando no caminho feliz (checkout completo, webhook com token correto) — a instrumentação não deve mudar nenhum comportamento observável no caso de sucesso.
- [ ] Depois que o usuário provisionar o Sentry (Step 1 do Task 1): forçar um erro de teste em produção/preview e confirmar que aparece no Sentry sem CPF/telefone/endereço, e que o e-mail de alerta chega.
