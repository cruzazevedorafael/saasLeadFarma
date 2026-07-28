# Fundação de Segurança (Bloco 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar as lacunas de segurança que hoje bloqueiam liberar o LeadFarma para uma farmácia real com dados de cliente reais — bypass de RLS via RPC, rate limiting ausente, webhook de pagamento fail-open, vazamento de estoque entre farmácias, checkout sem validação de schema, senha de superadmin exposta, e CVE conhecido do Next.js.

**Architecture:** Cada item é uma mudança isolada e testável — migrations SQL novas para o banco (numeradas 0015-0017, seguindo a sequência existente), um helper novo (`lib/rate-limit.ts`) reusado por 5 Server Actions, correções pontuais em arquivos existentes. Nenhuma mudança de arquitetura maior — tudo dentro dos padrões já estabelecidos no projeto (Server Actions com `createAdminClient()`, migrations aplicadas via `scripts/apply-migration.mjs`, testes Vitest com banco fake).

**Tech Stack:** Next.js 16 (App Router) + Supabase (Postgres/Auth) + Vitest + Upstash Redis (novo, via `@upstash/ratelimit` e `@upstash/redis`).

## Global Constraints

- Migrations aplicadas com `node scripts/apply-migration.mjs supabase/migrations/<arquivo>.sql` (usa `SUPABASE_ACCESS_TOKEN` de `.env.local`).
- Nenhuma tabela/função nova sem RLS habilitado (padrão do projeto — ver qualquer migration existente).
- Todo teste novo segue o padrão de banco fake já usado em `app/_actions/*.test.ts` (mock de `@/lib/supabase/admin` via `vi.mock`) — não bater em serviço real (Supabase, Upstash) em teste.
- Mensagens de erro para o usuário final em português, tom direto, mesmo padrão das mensagens já existentes em `app/_actions/criar-pedido.ts`.
- Rodar `npx vitest run` e `npm run build` no fim de cada tarefa antes de commitar.

---

## Task 1: Levantar e travar as funções `SECURITY DEFINER`

**Files:**
- Create: `supabase/migrations/0015_lockdown_security_definer.sql`

**Interfaces:**
- Produces: nenhuma interface de código — só efeito no banco (permissões).

- [ ] **Step 1: Confirmar a lista completa de funções `SECURITY DEFINER` no schema ativo**

Rodar (já confirmado durante o planejamento, mas repita para garantir que nada mudou):
```bash
grep -rn "security definer" supabase/migrations/*.sql
```
Lista confirmada (schema `public`, excluindo `_karolla_archive/`, que é legado morto):
- `current_pharmacy_id()` — **NÃO tocar**: usada dentro das próprias policies de RLS, avaliada com o privilégio do papel que fez a query. Revogar `authenticated` quebraria todo o RLS do sistema.
- `is_superadmin()` — **NÃO tocar**, mesmo motivo.
- `reserve_order(uuid)`, `complete_order(uuid)`, `cancel_order(uuid)` — travar.
- `reservar_item(uuid, uuid, int)`, `liberar_item(uuid, uuid)`, `liberar_carrinho(uuid)` — travar.
- `upsert_customer(uuid, text, text, text, text, text, text, text, text, text, text, boolean)` — travar.
- `increment_customer_orders(uuid)` — travar.
- `pharmacies_guard_sensitive_cols()` (`0009_hardening_pharmacies_e_indices.sql`) — função de **trigger** (`returns trigger`), não pode ser chamada via RPC direto (Postgres recusa: "trigger functions can only be called as triggers"). Não precisa de `revoke`.

- [ ] **Step 2: Escrever a migration**

```sql
-- supabase/migrations/0015_lockdown_security_definer.sql
-- Fecha a brecha: authenticated mantinha EXECUTE default nas funções
-- security definer de pedido/carrinho/cliente (as migrations 0002/0004
-- revogaram de anon/public, mas nunca de authenticated — que herda o grant
-- automático que o Supabase concede na criação da função). Qualquer farmácia
-- auto-cadastrada em /cadastro (público, sem aprovação) ganhava um JWT
-- authenticated e podia chamar essas funções direto via PostgREST
-- (POST /rest/v1/rpc/<função>), ignorando toda a lógica das Server Actions:
-- cancelar pedido de outra farmácia, sobrescrever cadastro de cliente alheio,
-- zerar estoque de concorrente.
--
-- Nenhum fluxo do app é afetado: todas essas funções já são chamadas
-- exclusivamente por Server Actions via createAdminClient() (service_role),
-- que ignora GRANT/REVOKE de qualquer forma.
--
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0015_lockdown_security_definer.sql

revoke execute on function public.reserve_order(uuid) from authenticated;
revoke execute on function public.complete_order(uuid) from authenticated;
revoke execute on function public.cancel_order(uuid) from authenticated;
revoke execute on function public.reservar_item(uuid, uuid, int) from authenticated;
revoke execute on function public.liberar_item(uuid, uuid) from authenticated;
revoke execute on function public.liberar_carrinho(uuid) from authenticated;
revoke execute on function public.upsert_customer(uuid, text, text, text, text, text, text, text, text, text, text, boolean) from authenticated;
revoke execute on function public.increment_customer_orders(uuid) from authenticated;
```

- [ ] **Step 3: Aplicar a migration**

```bash
node scripts/apply-migration.mjs supabase/migrations/0015_lockdown_security_definer.sql
```
Espera: `✅ Migrações aplicadas`.

- [ ] **Step 4: Verificar no banco que o revoke pegou**

```bash
node -e "
const env = {}
for (const line of require('fs').readFileSync('.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*\$/)
  if (m) env[m[1]] = m[2]
}
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]
const funcs = [
  'public.reserve_order(uuid)', 'public.complete_order(uuid)', 'public.cancel_order(uuid)',
  'public.reservar_item(uuid,uuid,int)', 'public.liberar_item(uuid,uuid)', 'public.liberar_carrinho(uuid)',
  'public.upsert_customer(uuid,text,text,text,text,text,text,text,text,text,text,boolean)',
  'public.increment_customer_orders(uuid)',
]
const query = funcs.map(f => \`select '\${f}' as fn, has_function_privilege('authenticated', '\${f}', 'execute') as pode_executar\`).join(' union all ')
fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + env.SUPABASE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
}).then(r => r.json()).then(rows => console.log(JSON.stringify(rows, null, 2)))
"
```
Expected: todas as linhas com `pode_executar: false`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0015_lockdown_security_definer.sql
git commit -m "fix(seguranca): revoga EXECUTE de authenticated nas funcoes security definer de pedido/cliente"
```

---

## Task 2: Helper de rate limiting (Upstash Redis) + IP do cliente

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `lib/rate-limit.test.ts`
- Create: `lib/request-ip.ts`
- Modify: `package.json` (nova dependência)
- Modify: `.env.example`

**Interfaces:**
- Produces: `checkRateLimit(name: RateLimitName, key: string): Promise<{ ok: boolean; error?: string }>` — usado pelas Tasks 3-7. `RateLimitName = 'login' | 'cadastro' | 'buscarCliente' | 'reservarItem' | 'criarPedido'`.
- Produces: `getClientIp(): Promise<string>` — usado pelas Tasks 3-7.

- [ ] **Step 1: Provisionar o Upstash Redis via Vercel Marketplace**

Isso precisa da sua conta Vercel autenticada (não dá pra automatizar sem OAuth interativo). No dashboard da Vercel: **Storage → Marketplace Database Providers → Upstash → Create** (ou `vercel integration add upstash` se o CLI da Vercel já estiver instalado — hoje não está, `npm i -g vercel` primeiro). Depois de criado, conecte ao projeto LeadFarma — a Vercel injeta `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` automaticamente nas env vars do projeto. Rode `vercel env pull .env.local` (ou copie manualmente do dashboard) pra ter essas duas variáveis localmente.

- [ ] **Step 2: Instalar as dependências**

```bash
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 3: Escrever o teste (falha primeiro)**

```typescript
// lib/rate-limit.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const limitMock = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(() => ({ limit: limitMock })),
    { slidingWindow: vi.fn() },
  ),
}))

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.resetModules()
    limitMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sem Upstash configurado: deixa passar (fail-open) e loga aviso', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(true)
  })

  it('dentro do limite: permite', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')
    limitMock.mockResolvedValue({ success: true })
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(true)
  })

  it('acima do limite: bloqueia com mensagem amigável', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')
    limitMock.mockResolvedValue({ success: false })
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Muitas tentativas')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: FAIL — `Cannot find module './rate-limit'`.

- [ ] **Step 3: Implementar `lib/rate-limit.ts`**

```typescript
// lib/rate-limit.ts
// Rate limiting real (funciona entre múltiplas instâncias serverless) via
// Upstash Redis. Se as env vars não estiverem configuradas, falha aberto
// (deixa passar) e loga um erro — melhor que derrubar o app inteiro, mas
// NUNCA deve acontecer em produção depois que o Upstash for provisionado.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Window = `${number} ${'s' | 'm' | 'h'}`

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null

function makeLimiter(requests: number, window: Window, prefix: string) {
  if (!redis) return null
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix })
}

const limiters = {
  login: makeLimiter(5, '15 m', 'rl:login'),
  cadastro: makeLimiter(5, '1 h', 'rl:cadastro'),
  buscarCliente: makeLimiter(5, '10 m', 'rl:buscar-cliente'),
  reservarItem: makeLimiter(30, '1 m', 'rl:reservar-item'),
  criarPedido: makeLimiter(10, '1 h', 'rl:criar-pedido'),
} as const

export type RateLimitName = keyof typeof limiters

export interface RateLimitResult {
  ok: boolean
  error?: string
}

export async function checkRateLimit(name: RateLimitName, key: string): Promise<RateLimitResult> {
  const limiter = limiters[name]
  if (!limiter) {
    console.error(`[rate-limit] Upstash não configurado — "${name}" está SEM proteção de rate limit.`)
    return { ok: true }
  }
  const { success } = await limiter.limit(key)
  if (!success) return { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }
  return { ok: true }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Implementar `lib/request-ip.ts`**

```typescript
// lib/request-ip.ts
// IP do cliente numa Server Action — a Vercel injeta x-forwarded-for.
import { headers } from 'next/headers'

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}
```

- [ ] **Step 6: Atualizar `.env.example`**

```
# Supabase (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Rate limiting (Vercel Marketplace → Upstash → conectar ao projeto)
UPSTASH_REDIS_REST_URL=https://seu-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=seu-token-upstash
```

- [ ] **Step 7: Commit**

```bash
git add lib/rate-limit.ts lib/rate-limit.test.ts lib/request-ip.ts package.json package-lock.json .env.example
git commit -m "feat(seguranca): helper de rate limiting via Upstash Redis"
```

---

## Task 3: Rate limit no login do painel

**Files:**
- Modify: `app/painel/login/actions.ts`
- Modify: `app/painel/login/page.tsx`
- Create: `app/painel/login/actions.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit('login', key)`, `getClientIp()` de `lib/rate-limit.ts`/`lib/request-ip.ts` (Task 2).

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```typescript
// app/painel/login/actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { login } from './actions'

const signInMock = vi.fn()
const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
let rateLimitOk = true

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '9.9.9.9' }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signInMock } }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))

function formData(email: string, password: string) {
  const fd = new FormData()
  fd.set('email', email)
  fd.set('password', password)
  return fd
}

beforeEach(() => {
  signInMock.mockReset()
  redirectMock.mockClear()
  rateLimitOk = true
})

describe('login', () => {
  it('acima do limite: redireciona pra login com erro de limite, sem chamar o Supabase', async () => {
    rateLimitOk = false
    await expect(login(formData('a@a.com', '123456'))).rejects.toThrow('REDIRECT:/painel/login?erro=limite')
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('dentro do limite, credenciais corretas: redireciona pro painel', async () => {
    signInMock.mockResolvedValue({ error: null })
    await expect(login(formData('a@a.com', '123456'))).rejects.toThrow('REDIRECT:/painel')
  })

  it('dentro do limite, credenciais erradas: redireciona pro login com erro genérico', async () => {
    signInMock.mockResolvedValue({ error: { message: 'invalid' } })
    await expect(login(formData('a@a.com', 'errada'))).rejects.toThrow('REDIRECT:/painel/login?erro=1')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/painel/login/actions.test.ts`
Expected: FAIL (o comportamento de rate limit ainda não existe — o teste `acima do limite` chama o Supabase, que não está mockado pra esse caso).

- [ ] **Step 3: Implementar**

```typescript
// app/painel/login/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

export async function login(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))

  const ip = await getClientIp()
  const rl = await checkRateLimit('login', `${ip}:${email}`)
  if (!rl.ok) redirect('/painel/login?erro=limite')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/painel/login?erro=1')
  redirect('/painel')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/painel/login')
}
```

- [ ] **Step 4: Atualizar a página de login pra mostrar a mensagem de limite**

Em `app/painel/login/page.tsx`, trocar:
```tsx
        {erro && <p className="text-sm text-destructive text-center">E-mail ou senha inválidos.</p>}
```
por:
```tsx
        {erro === 'limite' && (
          <p className="text-sm text-destructive text-center">Muitas tentativas. Aguarde alguns minutos e tente de novo.</p>
        )}
        {erro && erro !== 'limite' && <p className="text-sm text-destructive text-center">E-mail ou senha inválidos.</p>}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/painel/login/actions.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add app/painel/login/actions.ts app/painel/login/page.tsx app/painel/login/actions.test.ts
git commit -m "feat(seguranca): rate limit no login do painel (5 tentativas/15min)"
```

---

## Task 4: Rate limit no auto-cadastro

**Files:**
- Modify: `app/cadastro/actions.ts`
- Create: `app/cadastro/actions.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit('cadastro', key)`, `getClientIp()`.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```typescript
// app/cadastro/actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { autoCadastro } from './actions'

const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const provisionMock = vi.fn()
let rateLimitOk = true

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '5.5.5.5' }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signInWithPassword: vi.fn() } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }))
vi.mock('@/lib/data/pharmacy-provisioning', () => ({ provisionPharmacy: (...args: any[]) => provisionMock(...args) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))

const input = { nomeFantasia: 'Farmácia Teste', emailAdmin: 'a@a.com', senhaAdmin: '123456', whatsapp: '' }

beforeEach(() => {
  redirectMock.mockClear()
  provisionMock.mockReset()
  rateLimitOk = true
})

describe('autoCadastro', () => {
  it('acima do limite: devolve erro amigável, sem provisionar', async () => {
    rateLimitOk = false
    const r = await autoCadastro(input)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Muitas tentativas')
    expect(provisionMock).not.toHaveBeenCalled()
  })

  it('dentro do limite: provisiona e redireciona pro onboarding', async () => {
    provisionMock.mockResolvedValue({ ok: true })
    await expect(autoCadastro(input)).rejects.toThrow('REDIRECT:/painel/cadastro')
    expect(provisionMock).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/cadastro/actions.test.ts`
Expected: FAIL — `checkRateLimit` mockado não é chamado ainda, o teste "acima do limite" não bate porque `autoCadastro` sempre provisiona.

- [ ] **Step 3: Implementar**

Em `app/cadastro/actions.ts`, adicionar os imports e a checagem no início de `autoCadastro`:

```typescript
'use server'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { provisionPharmacy } from '@/lib/data/pharmacy-provisioning'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

const schema = z.object({
  nomeFantasia: z.string().trim().min(2, 'Informe o nome da farmácia'),
  emailAdmin: z.string().trim().email('E-mail inválido'),
  senhaAdmin: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
  whatsapp: z.string().trim().optional().default(''),
})

export type AutoCadastroInput = z.infer<typeof schema>

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
  const ip = await getClientIp()
  const rl = await checkRateLimit('cadastro', ip)
  if (!rl.ok) return { ok: false, error: rl.error! }

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

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email: d.emailAdmin, password: d.senhaAdmin })
  redirect('/painel/cadastro')
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/cadastro/actions.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add app/cadastro/actions.ts app/cadastro/actions.test.ts
git commit -m "feat(seguranca): rate limit no auto-cadastro (5/hora por IP)"
```

---

## Task 5: Rate limit em `buscarClientePorCpf`

**Files:**
- Modify: `app/_actions/buscar-cliente.ts`
- Create: `app/_actions/buscar-cliente.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit('buscarCliente', key)`, `getClientIp()`.

- [ ] **Step 1: Escrever o teste (falha primeiro)**

```typescript
// app/_actions/buscar-cliente.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buscarClientePorCpf } from './buscar-cliente'

let customerRow: any = null
let rateLimitOk = true

function fakeDb() {
  return {
    from() {
      return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: customerRow }) }) }) }) }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '7.7.7.7' }) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))

beforeEach(() => {
  customerRow = { name: 'Maria', phone: '11988887777', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', lgpd_consent: true }
  rateLimitOk = true
})

describe('buscarClientePorCpf', () => {
  it('acima do limite: devolve null sem consultar o banco', async () => {
    rateLimitOk = false
    const r = await buscarClientePorCpf('ph1', '52998224725', '7777')
    expect(r).toBeNull()
  })

  it('dentro do limite, CPF e 2ª prova corretos: devolve o cadastro', async () => {
    const r = await buscarClientePorCpf('ph1', '52998224725', '7777')
    expect(r?.name).toBe('Maria')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/_actions/buscar-cliente.test.ts`
Expected: FAIL — o caso "acima do limite" ainda retorna o cadastro (rate limit não implementado).

- [ ] **Step 3: Implementar**

```typescript
// app/_actions/buscar-cliente.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCpf, onlyDigits } from '@/lib/cpf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

export interface ClienteAutofill {
  name: string
  phone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  lgpdConsent: boolean
}

export async function buscarClientePorCpf(
  pharmacyId: string,
  cpf: string,
  phoneLast4: string,
): Promise<ClienteAutofill | null> {
  const ip = await getClientIp()
  const rl = await checkRateLimit('buscarCliente', `${ip}:${pharmacyId}`)
  if (!rl.ok) return null

  const digits = onlyDigits(cpf)
  const prova = onlyDigits(phoneLast4).slice(-4)
  if (!pharmacyId || !isValidCpf(digits) || prova.length !== 4) return null
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('customers')
      .select('name, phone, cep, logradouro, numero, complemento, bairro, cidade, uf, lgpd_consent')
      .eq('pharmacy_id', pharmacyId)
      .eq('cpf', digits)
      .single()
    if (!data) return null
    if (onlyDigits(data.phone ?? '').slice(-4) !== prova) return null
    return {
      name: data.name ?? '', phone: data.phone ?? '',
      cep: data.cep ?? '', logradouro: data.logradouro ?? '', numero: data.numero ?? '',
      complemento: data.complemento ?? '', bairro: data.bairro ?? '', cidade: data.cidade ?? '', uf: data.uf ?? '',
      lgpdConsent: data.lgpd_consent ?? false,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/_actions/buscar-cliente.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add app/_actions/buscar-cliente.ts app/_actions/buscar-cliente.test.ts
git commit -m "feat(seguranca): rate limit em buscar-cliente (5/10min) contra forca bruta do 2o fator"
```

---

## Task 6: Rate limit em `reservarItem`

**Files:**
- Modify: `app/_actions/reserva-carrinho.ts`
- Modify: `app/_actions/reserva-carrinho.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit('reservarItem', key)`, `getClientIp()`.

- [ ] **Step 1: Adicionar o teste do novo comportamento (falha primeiro)**

Adicionar ao `describe('reservarItem', ...)` existente em `app/_actions/reserva-carrinho.test.ts` (mantendo os testes já existentes):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reservarItem, liberarItem, liberarCarrinho } from './reserva-carrinho'

let rpcCalls: { name: string; params: any }[] = []
let rpcData: any = 0
let rpcError: any = null
let rateLimitOk = true

function fakeDb() {
  return {
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params })
      return { data: rpcData, error: rpcError }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '8.8.8.8' }) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))

beforeEach(() => {
  rpcCalls = []
  rpcData = 0
  rpcError = null
  rateLimitOk = true
})

describe('reservarItem', () => {
  it('chama reservar_item e devolve quanto foi concedido', async () => {
    rpcData = 2
    const granted = await reservarItem('cart-1', 'var-1', 3)
    expect(granted).toBe(2)
    expect(rpcCalls).toEqual([{ name: 'reservar_item', params: { p_cart_id: 'cart-1', p_variant_id: 'var-1', p_quantity: 3 } }])
  })

  it('cartId ou variantId vazio: não chama o banco e devolve 0', async () => {
    const granted = await reservarItem('', 'var-1', 3)
    expect(granted).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })

  it('erro no banco: best effort, devolve a quantidade pedida (não trava o cliente)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rpcError = { message: 'boom' }
    const granted = await reservarItem('cart-1', 'var-1', 3)
    expect(granted).toBe(3)
  })

  it('acima do limite: devolve 0 sem chamar o banco', async () => {
    rateLimitOk = false
    const granted = await reservarItem('cart-1', 'var-1', 3)
    expect(granted).toBe(0)
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('liberarItem / liberarCarrinho', () => {
  it('liberarItem chama liberar_item', async () => {
    await liberarItem('cart-1', 'var-1')
    expect(rpcCalls).toEqual([{ name: 'liberar_item', params: { p_cart_id: 'cart-1', p_variant_id: 'var-1' } }])
  })
  it('liberarCarrinho chama liberar_carrinho', async () => {
    await liberarCarrinho('cart-1')
    expect(rpcCalls).toEqual([{ name: 'liberar_carrinho', params: { p_cart_id: 'cart-1' } }])
  })
  it('liberarCarrinho com cartId vazio não chama o banco', async () => {
    await liberarCarrinho('')
    expect(rpcCalls).toHaveLength(0)
  })
})
```

(Esse bloco substitui o arquivo inteiro — os 3 testes originais de `reservarItem` e os 3 de `liberarItem`/`liberarCarrinho` continuam, só ganham o `beforeEach` com `rateLimitOk` e o novo teste "acima do limite".)

- [ ] **Step 2: Rodar o teste e confirmar que o novo caso falha**

Run: `npx vitest run app/_actions/reserva-carrinho.test.ts`
Expected: FAIL no teste "acima do limite" — hoje `reservarItem` sempre chama o banco.

- [ ] **Step 3: Implementar**

```typescript
// app/_actions/reserva-carrinho.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

// Reserva (ou ajusta) a quantidade de uma variação para um carrinho.
// Devolve quanto foi efetivamente reservado. Em falha de banco, devolve a
// quantidade pedida (best effort) pra não travar o cliente — o pedido final
// ainda valida o estoque.
export async function reservarItem(cartId: string, variantId: string, quantity: number): Promise<number> {
  if (!cartId || !variantId) return 0

  const ip = await getClientIp()
  const rl = await checkRateLimit('reservarItem', ip)
  if (!rl.ok) return 0

  const db = createAdminClient()
  const { data, error } = await db.rpc('reservar_item', {
    p_cart_id: cartId, p_variant_id: variantId, p_quantity: quantity,
  })
  if (error) {
    console.error('[reservarItem] falha ao reservar:', error)
    return quantity
  }
  return Number(data ?? 0)
}

export async function liberarItem(cartId: string, variantId: string): Promise<void> {
  if (!cartId || !variantId) return
  const db = createAdminClient()
  await db.rpc('liberar_item', { p_cart_id: cartId, p_variant_id: variantId })
}

export async function liberarCarrinho(cartId: string): Promise<void> {
  if (!cartId) return
  const db = createAdminClient()
  await db.rpc('liberar_carrinho', { p_cart_id: cartId })
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/_actions/reserva-carrinho.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add app/_actions/reserva-carrinho.ts app/_actions/reserva-carrinho.test.ts
git commit -m "feat(seguranca): rate limit em reservarItem (30/min) contra esgotar estoque de propósito"
```

---

## Task 7: Validação zod + checagem de farmácia ativa + rate limit em `criarPedido`

**Files:**
- Modify: `app/_actions/criar-pedido.ts`
- Modify: `app/_actions/criar-pedido.test.ts`

**Interfaces:**
- Consumes: `checkRateLimit('criarPedido', key)`, `getClientIp()`.
- Consumes: `Pharmacy.status` (`'active' | 'suspended'`, já existe em `lib/data/pharmacy.ts`).

- [ ] **Step 1: Atualizar o teste existente (falha primeiro)**

Reescrever `app/_actions/criar-pedido.test.ts` inteiro:

```typescript
// app/_actions/criar-pedido.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { criarPedido } from './criar-pedido'

let productRows: any[] = []
let variantRows: any[] = []
let productsError: any = null
let orderInsertError: any = null
let insertedOrders: any[] = []
let rpcError: any = null
let deletedOrderIds: string[] = []
let rpcCalls: { name: string; params: any }[] = []
let pharmacyStatus: 'active' | 'suspended' = 'active'
let rateLimitOk = true

function fakeDb() {
  return {
    from(table: string) {
      if (table === 'products') {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: productRows, error: productsError }) }) }) }
      }
      if (table === 'product_variants') {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: variantRows, error: null }) }) }) }
      }
      if (table === 'shipping_methods' || table === 'payment_methods') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }
      }
      if (table === 'orders') {
        return {
          insert: (row: any) => {
            insertedOrders.push(row)
            return { select: () => ({ single: async () => ({ data: { id: 'o1', number: 7 }, error: orderInsertError }) }) }
          },
          delete: () => ({ eq: async (_col: string, id: string) => { deletedOrderIds.push(id); return { error: null } } }),
        }
      }
      if (table === 'order_items') {
        return { insert: async () => ({ error: null }) }
      }
      throw new Error(`tabela inesperada no teste: ${table}`)
    },
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params })
      return { error: rpcError }
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))
vi.mock('@/lib/data/pharmacy', () => ({
  getPharmacyById: async () => ({ id: 'ph1', wholesaleThreshold: 4, nomeExibicao: 'Farmácia Teste', whatsappNumber: '', status: pharmacyStatus }),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '3.3.3.3' }) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))

const legging = {
  id: 'L', code: 'LEG-001', name: 'Legging', price_cost: 20, price_wholesale: 50, price_retail: 90,
  weight_grams: 250, counts_for_wholesale: true,
}
const variante = { id: 'v1', product_id: 'L', size: 'M', color: 'Preto', stock: 5 }

const pedido = (quantity: number) => ({
  pharmacyId: 'ph1',
  customerName: 'Maria',
  customerPhone: '11988887777',
  items: [{ productId: 'L', size: 'M', color: 'Preto', quantity }],
})

beforeEach(() => {
  productRows = [legging]
  variantRows = [variante]
  productsError = null
  orderInsertError = null
  insertedOrders = []
  rpcError = null
  deletedOrderIds = []
  rpcCalls = []
  pharmacyStatus = 'active'
  rateLimitOk = true
})

describe('criarPedido', () => {
  it('sucesso: retorna ok true com o número do pedido e sem aviso de estoque', async () => {
    const r = await criarPedido(pedido(2))
    expect(r).toMatchObject({ ok: true, number: 7, priceType: 'retail', stockWarning: null })
  })

  it('estoque insuficiente: registra o pedido mesmo assim, com o aviso gravado e devolvido', async () => {
    const r = await criarPedido(pedido(9))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.number).toBe(7)
      expect(r.stockWarning).toContain('Estoque insuficiente')
      expect(r.stockWarning).toContain('Legging (M/Preto)')
    }
    expect(insertedOrders).toHaveLength(1)
    expect(insertedOrders[0].stock_warning).toContain('Estoque insuficiente')
  })

  it('produto que não existe mais: retorna ok false, sem lançar', async () => {
    productRows = []
    variantRows = []
    const r = await criarPedido(pedido(1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('não está mais no catálogo')
  })

  it('erro de banco: retorna ok false com mensagem amigável, sem lançar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    productsError = { message: 'boom' }
    const r = await criarPedido(pedido(1))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Não foi possível registrar')
  })

  it('reserva o estoque após criar o pedido (chama o rpc sem erro)', async () => {
    const r = await criarPedido(pedido(2))
    expect(r.ok).toBe(true)
    expect(deletedOrderIds).toHaveLength(0)
  })

  it('falha na reserva: apaga o pedido e retorna ok false', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rpcError = { message: 'falha na reserva' }
    const r = await criarPedido(pedido(2))
    expect(r.ok).toBe(false)
    expect(deletedOrderIds).toEqual(['o1'])
  })

  it('com cartId: libera o carrinho após reservar o estoque', async () => {
    const r = await criarPedido({ ...pedido(2), cartId: 'cart-9' })
    expect(r.ok).toBe(true)
    expect(rpcCalls.map((c) => c.name)).toEqual(['reserve_order', 'liberar_carrinho'])
    expect(rpcCalls[1].params).toEqual({ p_cart_id: 'cart-9' })
  })

  it('sem cartId: não chama liberar_carrinho', async () => {
    await criarPedido(pedido(2))
    expect(rpcCalls.map((c) => c.name)).toEqual(['reserve_order'])
  })

  it('acima do limite de rate limit: retorna ok false sem tocar no banco', async () => {
    rateLimitOk = false
    const r = await criarPedido(pedido(2))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Muitas tentativas')
    expect(insertedOrders).toHaveLength(0)
  })

  it('farmácia suspensa: recusa o pedido', async () => {
    pharmacyStatus = 'suspended'
    const r = await criarPedido(pedido(2))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('não está disponível')
    expect(insertedOrders).toHaveLength(0)
  })

  it('payload inválido (nome vazio): rejeita antes de tocar no banco', async () => {
    const r = await criarPedido({ ...pedido(2), customerName: '' })
    expect(r.ok).toBe(false)
    expect(insertedOrders).toHaveLength(0)
  })

  it('quantidade de item inválida (zero): rejeita antes de tocar no banco', async () => {
    const r = await criarPedido(pedido(0))
    expect(r.ok).toBe(false)
    expect(insertedOrders).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que os novos casos falham**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: FAIL nos 4 testes novos (rate limit, farmácia suspensa, payload inválido, quantidade inválida) — nenhum desses comportamentos existe ainda.

- [ ] **Step 3: Implementar**

```typescript
// app/_actions/criar-pedido.ts
'use server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPharmacyById } from '@/lib/data/pharmacy'
import { mapProductRow, mapVariantRow } from '@/lib/data/mappers'
import { buildOrder, stockShortages, type ChosenShipping, type ChosenPayment } from '@/lib/data/order.helpers'
import type { ProductWithVariants } from '@/lib/data/types'
import { onlyDigits } from '@/lib/cpf'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

const clienteSchema = z.object({
  cpf: z.string().max(20),
  cep: z.string().max(12),
  logradouro: z.string().max(200),
  numero: z.string().max(20),
  complemento: z.string().max(200),
  bairro: z.string().max(120),
  cidade: z.string().max(120),
  uf: z.string().max(2),
  lgpdConsent: z.boolean(),
})

const itemSchema = z.object({
  productId: z.string().min(1),
  size: z.string().max(60),
  color: z.string().max(60),
  quantity: z.number().int().positive().max(999),
})

const criarPedidoSchema = z.object({
  pharmacyId: z.string().min(1),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(20),
  cliente: clienteSchema.nullable().optional(),
  items: z.array(itemSchema).min(1).max(100),
  shippingMethodId: z.string().nullable().optional(),
  paymentMethodId: z.string().nullable().optional(),
  cartId: z.string().nullable().optional(),
})

export type CriarPedidoInput = z.infer<typeof criarPedidoSchema>
export type CriarPedidoCliente = NonNullable<CriarPedidoInput['cliente']>

// Erros esperados (produto removido, banco fora) voltam como { ok: false } com
// mensagem própria — em produção o Next mascara mensagens de erro lançadas em
// server actions, então lançar deixaria o cliente sem saber o motivo.
// Estoque insuficiente NÃO bloqueia: o pedido é registrado com o aviso em
// stockWarning e a loja resolve com o cliente.
export type CriarPedidoResult =
  | { ok: true; number: number; total: number; priceType: 'retail' | 'wholesale'; stockWarning: string | null }
  | { ok: false; error: string }

export async function criarPedido(input: unknown): Promise<CriarPedidoResult> {
  const parsed = criarPedidoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Dados do pedido inválidos. Atualize a página e tente de novo.' }

  const ip = await getClientIp()
  const rl = await checkRateLimit('criarPedido', ip)
  if (!rl.ok) return { ok: false, error: rl.error! }

  try {
    return await registrarPedido(parsed.data)
  } catch (e) {
    console.error('[criarPedido] falha ao registrar pedido:', e)
    return { ok: false, error: 'Não foi possível registrar o pedido. Verifique sua internet e tente de novo.' }
  }
}

async function registrarPedido(input: CriarPedidoInput): Promise<CriarPedidoResult> {
  if (!input.items?.length) return { ok: false, error: 'Carrinho vazio' }
  if (!input.pharmacyId) return { ok: false, error: 'Farmácia não identificada.' }

  const pharmacy = await getPharmacyById(input.pharmacyId)
  if (!pharmacy || pharmacy.status !== 'active') {
    return { ok: false, error: 'Esta farmácia não está disponível para pedidos no momento.' }
  }

  const db = createAdminClient()
  const ids = [...new Set(input.items.map((i) => i.productId))]

  // Todas as leituras/escritas são presas à farmácia do catálogo (input.pharmacyId).
  const { data: prows, error } = await db.from('products').select('*').eq('pharmacy_id', input.pharmacyId).in('id', ids)
  if (error) throw error
  const { data: vrows, error: vErr } = await db.from('product_variants').select('*').eq('pharmacy_id', input.pharmacyId).in('product_id', ids)
  if (vErr) throw vErr

  const products: ProductWithVariants[] = (prows ?? []).map((p) => ({
    ...mapProductRow(p),
    variants: (vrows ?? []).filter((v) => v.product_id === p.id).map(mapVariantRow),
  }))

  // Sem o cadastro do produto não dá pra montar o item (carrinho antigo no
  // celular do cliente apontando pra produto apagado): aí sim bloqueia.
  const existentes = new Set(products.map((p) => p.id))
  if (input.items.some((i) => !existentes.has(i.productId))) {
    return { ok: false, error: 'Um dos produtos do carrinho não está mais no catálogo. Atualize a página e monte o carrinho de novo.' }
  }

  const faltas = stockShortages(products, input.items)
  const stockWarning = faltas.length
    ? `Estoque insuficiente: ${faltas.map((f) => `${f.name} (${f.size}/${f.color}) — pedido ${f.requested}, restam ${f.stock}`).join('; ')}`
    : null

  // resolve envio/pagamento a partir do banco (não confia em valores do cliente)
  let shipping: ChosenShipping | undefined
  if (input.shippingMethodId) {
    const { data: s } = await db.from('shipping_methods').select('name, price').eq('id', input.shippingMethodId).eq('pharmacy_id', input.pharmacyId).single()
    if (s) shipping = { label: s.name, price: Number(s.price ?? 0) }
  }
  let payment: ChosenPayment | undefined
  if (input.paymentMethodId) {
    const { data: pm } = await db.from('payment_methods').select('name, surcharge_percent, surcharge_fixed').eq('id', input.paymentMethodId).eq('pharmacy_id', input.pharmacyId).single()
    if (pm) payment = { label: pm.name, percent: Number(pm.surcharge_percent ?? 0), fixed: Number(pm.surcharge_fixed ?? 0) }
  }

  const threshold = pharmacy.wholesaleThreshold ?? 4
  const built = buildOrder(products, input.items, threshold, shipping, payment)

  const cli = input.cliente
  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({
      pharmacy_id: input.pharmacyId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_cpf: cli ? onlyDigits(cli.cpf) : '',
      customer_cep: cli?.cep ?? '',
      customer_logradouro: cli?.logradouro ?? '',
      customer_numero: cli?.numero ?? '',
      customer_complemento: cli?.complemento ?? '',
      customer_bairro: cli?.bairro ?? '',
      customer_cidade: cli?.cidade ?? '',
      customer_uf: cli?.uf ?? '',
      status: 'pending',
      price_type: built.priceType,
      items_subtotal: built.itemsSubtotal,
      shipping_label: built.shippingLabel,
      shipping_price: built.shippingPrice,
      payment_label: built.paymentLabel,
      payment_surcharge: built.paymentSurcharge,
      total: built.total,
      stock_warning: stockWarning,
    })
    .select('id, number')
    .single()
  if (oErr) throw oErr

  const itemRows = built.items.map((it) => ({ ...it, order_id: order.id, pharmacy_id: input.pharmacyId }))
  const { error: iErr } = await db.from('order_items').insert(itemRows)
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw iErr
  }

  // Cadastro do cliente (registro/histórico) só é gravado COM consentimento LGPD.
  // O pedido em si já guarda o snapshot acima (necessário pra atender a venda).
  // Falha aqui não derruba o pedido — a venda continua válida.
  if (cli && cli.lgpdConsent && onlyDigits(cli.cpf).length === 11) {
    try {
      const { data: customerId, error: cErr } = await db.rpc('upsert_customer', {
        p_pharmacy_id: input.pharmacyId, p_cpf: onlyDigits(cli.cpf),
        p_name: input.customerName, p_phone: input.customerPhone,
        p_cep: cli.cep, p_logradouro: cli.logradouro, p_numero: cli.numero,
        p_complemento: cli.complemento, p_bairro: cli.bairro, p_cidade: cli.cidade,
        p_uf: cli.uf, p_consent: true,
      })
      if (cErr) throw cErr
      if (customerId) {
        await db.from('orders').update({ customer_id: customerId }).eq('id', order.id)
        await db.rpc('increment_customer_orders', { p_customer_id: customerId })
      }
    } catch (e) {
      console.error('[criarPedido] falha ao gravar cliente (pedido mantido):', e)
    }
  }

  // Reserva o estoque (desconta as peças). Pode ficar negativo — não bloqueia,
  // o stockWarning acima já avisa a loja. Se a reserva falhar, desfaz o pedido.
  const { error: rErr } = await db.rpc('reserve_order', { p_order_id: order.id })
  if (rErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw rErr
  }

  // Já baixamos o estoque de verdade; solta as reservas de carrinho desse cliente
  // pra não descontar duas vezes. Falha aqui não derruba o pedido (a reserva
  // expira sozinha em 30 min).
  if (input.cartId) {
    const { error: lErr } = await db.rpc('liberar_carrinho', { p_cart_id: input.cartId })
    if (lErr) console.error('[criarPedido] falha ao liberar carrinho:', lErr)
  }

  return { ok: true, number: order.number as number, total: built.total, priceType: built.priceType, stockWarning }
}
```

> **Nota:** o tipo `CriarPedidoInput` mudou de `interface` manual para `z.infer<typeof criarPedidoSchema>`. Buscar por outros arquivos que importam `CriarPedidoInput`/`CriarPedidoCliente` de `@/app/_actions/criar-pedido` (o componente de checkout do carrinho, provavelmente `components/cart.tsx`) e confirmar que os campos batem — o shape é o mesmo, só a origem do tipo mudou.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: PASS (13 testes).

- [ ] **Step 5: Rodar a suíte inteira e o build, pra garantir que nada mais quebrou com a troca de tipo**

Run: `npx vitest run && npm run build`
Expected: tudo verde. Se `components/cart.tsx` (ou outro caller) não bater com o novo schema, ajustar o caller — não o schema — pra manter os limites de tamanho definidos acima.

- [ ] **Step 6: Commit**

```bash
git add app/_actions/criar-pedido.ts app/_actions/criar-pedido.test.ts
git commit -m "feat(seguranca): valida payload com zod, checa farmacia ativa e aplica rate limit em criarPedido"
```

---

## Task 8: Webhook Asaas fail-closed + idempotência

**Files:**
- Create: `supabase/migrations/0016_asaas_webhook_events.sql`
- Modify: `app/api/asaas/webhook/route.ts`
- Create: `app/api/asaas/webhook/route.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: tabela `public.asaas_webhook_events(event_id text primary key, processed_at timestamptz)`.

- [ ] **Step 1: Migration da tabela de idempotência**

```sql
-- supabase/migrations/0016_asaas_webhook_events.sql
-- Idempotência do webhook do Asaas: evita reprocessar o mesmo evento em
-- caso de retry/replay (acidental ou malicioso — sem isso, reenviar o mesmo
-- payload de PAYMENT_CONFIRMED repetidas vezes não causa dano hoje, mas
-- qualquer lógica futura que reaja a evento uma única vez precisa disso).
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0016_asaas_webhook_events.sql

create table if not exists public.asaas_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.asaas_webhook_events enable row level security;
-- sem policies → só service_role acessa (o webhook roda com createAdminClient()).
revoke all on public.asaas_webhook_events from anon, authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar a migration**

```bash
node scripts/apply-migration.mjs supabase/migrations/0016_asaas_webhook_events.sql
```
Expected: `✅ Migrações aplicadas`.

- [ ] **Step 3: Escrever o teste (falha primeiro)**

```typescript
// app/api/asaas/webhook/route.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'

let insertError: any = null
let insertedEvents: any[] = []
let updateCalls: any[] = []

function fakeDb() {
  return {
    from(table: string) {
      if (table === 'asaas_webhook_events') {
        return { insert: async (row: any) => { insertedEvents.push(row); return { error: insertError } } }
      }
      if (table === 'pharmacies') {
        return {
          update: (patch: any) => ({
            eq: async (col: string, val: string) => { updateCalls.push({ patch, col, val }); return { error: null } },
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

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/api/asaas/webhook/route.test.ts`
Expected: FAIL — o comportamento atual é fail-open (aceita sem token) e não tem idempotência.

- [ ] **Step 5: Implementar**

```typescript
// app/api/asaas/webhook/route.ts — recebe eventos de cobrança do ASAAS.
// Fail-closed: sem ASAAS_WEBHOOK_TOKEN configurado, recusa TUDO (500) em vez
// de aceitar sem validar. Comparação de token com timingSafeEqual. Idempotente
// via asaas_webhook_events — evento repetido não reprocessa.
//
// NOTA: o campo usado como id do evento (`body.id`) segue a documentação do
// Asaas na data desta implementação — confirme contra um payload real assim
// que a integração for ativada de verdade (ASAAS_API_KEY configurada).
import { timingSafeEqual } from 'node:crypto'
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
  if (eventId) {
    const { error: insertError } = await db.from('asaas_webhook_events').insert({ event_id: eventId })
    if (insertError) {
      if (insertError.code === '23505') return new Response('ok', { status: 200 }) // já processado
      console.error('[asaas webhook] falha ao registrar evento (seguindo mesmo assim):', insertError)
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
    if (error) console.error('[asaas webhook] falha ao atualizar farmácia:', error)
  }

  // ASAAS espera 200 para não reenviar.
  return new Response('ok', { status: 200 })
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run app/api/asaas/webhook/route.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 7: Atualizar `.env.example`**

```
# Asaas (cobrança) — deixe em branco pra rodar em modo manual (sem cobrança automática)
ASAAS_API_KEY=
ASAAS_ENV=sandbox
ASAAS_WEBHOOK_TOKEN=gere-um-token-aleatorio-forte-aqui
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0016_asaas_webhook_events.sql app/api/asaas/webhook/route.ts app/api/asaas/webhook/route.test.ts .env.example
git commit -m "fix(seguranca): webhook Asaas fail-closed, comparacao timing-safe e idempotencia"
```

---

## Task 9: Corrigir `public_product_variants` (vazamento de estoque entre farmácias)

**Files:**
- Create: `supabase/migrations/0017_fix_public_product_variants.sql`

**Interfaces:**
- Nenhuma mudança de interface: `pharmacy_id` continua na view (é usado por `lib/data/products.ts:21`, `.eq('pharmacy_id', pharmacyId)`) — só o filtro de farmácia/produto ativo é adicionado, igual já existe em `public_products`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0017_fix_public_product_variants.sql
-- public_product_variants vazava estoque de TODAS as farmácias (inclusive
-- suspensas/inativas) pra qualquer visitante anônimo — a view não filtrava
-- por pharmacy.status/product.active, diferente de public_products (que já
-- filtra desde 0002). Prova: GET /rest/v1/public_product_variants?select=*
-- com a anon key retornava linhas de farmácias suspensas.
--
-- pharmacy_id é MANTIDO na view (lib/data/products.ts:21 filtra por ele ao
-- buscar as variantes de um produto) — o problema nunca foi esse campo estar
-- visível, foi a ausência do filtro de farmácia/produto ativo.
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0017_fix_public_product_variants.sql

drop view if exists public.public_product_variants;

create view public.public_product_variants with (security_invoker = false) as
  select pv.id, pv.product_id, pv.pharmacy_id, pv.size, pv.color,
         ((pv.stock - coalesce(r.reserved, 0)) > 0) as available,
         greatest(pv.stock - coalesce(r.reserved, 0), 0)::int as stock
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  join public.pharmacies ph on ph.id = pv.pharmacy_id
  left join (
    select variant_id, sum(quantity)::int as reserved
    from public.cart_reservations
    where expires_at > now()
    group by variant_id
  ) r on r.variant_id = pv.id
  where p.active = true and ph.status = 'active';

grant select on public.public_product_variants to anon;
```

- [ ] **Step 2: Aplicar a migration**

```bash
node scripts/apply-migration.mjs supabase/migrations/0017_fix_public_product_variants.sql
```
Expected: `✅ Migrações aplicadas`.

- [ ] **Step 3: Verificar manualmente que o catálogo público continua funcionando**

```bash
npm run dev
```
Abrir `/f/<slug-de-uma-farmácia-ativa-com-produto>` no navegador e confirmar que os produtos e o estoque aparecem normalmente (a mudança não deve mudar nada visível pra farmácia ativa — só passa a esconder farmácia suspensa/produto inativo).

- [ ] **Step 4: Verificar a definição da view no banco**

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
  body: JSON.stringify({ query: \"select pg_get_viewdef('public.public_product_variants', true) as def\" }),
}).then(r => r.json()).then(rows => console.log(rows[0].def))
"
```
Expected: a definição impressa contém `ph.status = 'active'::text` e `p.active = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0017_fix_public_product_variants.sql
git commit -m "fix(seguranca): public_product_variants nao vaza mais estoque de farmacia suspensa/produto inativo"
```

---

## Task 10: Ajustar copy de consentimento no checkout

**Files:**
- Modify: `components/checkout-cliente.tsx`

**Interfaces:** nenhuma — só texto.

- [ ] **Step 1: Trocar o texto do checkbox de consentimento**

Em `components/checkout-cliente.tsx`, trocar:
```tsx
      <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 cursor-pointer">
        <input type="checkbox" checked={value.lgpdConsent}
          onChange={(e) => set({ lgpdConsent: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[#F97316]" />
        <span className="text-[11px] md:text-xs text-muted-foreground leading-snug">
          <ShieldCheck className="inline h-3.5 w-3.5 text-[#F97316] mr-1 align-text-bottom" />
          Autorizo o uso dos meus dados (nome, CPF, contato e endereço) para processar este pedido e
          agilizar compras futuras nesta farmácia, conforme a <strong className="text-foreground">LGPD</strong>.
        </span>
      </label>
```
por:
```tsx
      <label className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 cursor-pointer">
        <input type="checkbox" checked={value.lgpdConsent}
          onChange={(e) => set({ lgpdConsent: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[#F97316]" />
        <span className="text-[11px] md:text-xs text-muted-foreground leading-snug">
          <ShieldCheck className="inline h-3.5 w-3.5 text-[#F97316] mr-1 align-text-bottom" />
          Seus dados (nome, CPF, contato e endereço) sempre são usados para processar este pedido.
          Autorizo também guardar meu cadastro para agilizar compras futuras nesta farmácia, conforme a{' '}
          <strong className="text-foreground">LGPD</strong>.
        </span>
      </label>
```

- [ ] **Step 2: Rodar o build pra confirmar que não quebrou nada**

Run: `npm run build`
Expected: build limpo (é só texto, sem lógica nova).

- [ ] **Step 3: Commit**

```bash
git add components/checkout-cliente.tsx
git commit -m "docs(checkout): deixa claro que o pedido em si sempre usa os dados; consentimento controla o cadastro salvo"
```

---

## Task 11: Rotacionar senha do superadmin + remover senha em texto plano

**Files:**
- Create: `scripts/rotate-superadmin-password.mjs`
- Modify: `scripts/seed-fase0.mjs`
- Modify: `docs/05-SETUP-E-EXECUCAO.md`
- Modify: `docs/superpowers/plans/2026-07-07-leadfarma-fase-0-fundacao-multitenant.md`

**Interfaces:** nenhuma — scripts operacionais e docs.

- [ ] **Step 1: Escrever o script de rotação de senha**

```javascript
// scripts/rotate-superadmin-password.mjs
// Gera uma senha forte nova pro superadmin da plataforma e atualiza via
// Supabase Auth Admin API. A senha só aparece UMA VEZ no terminal — salve
// num gerenciador de senhas assim que rodar.
// Uso: node scripts/rotate-superadmin-password.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = 'leadfarma.br@gmail.com'
if (!SUPA_URL || !SERVICE) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local'); process.exit(1) }

function novaSenha() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  const bytes = randomBytes(20)
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

async function main() {
  // Nota: sem paginação — ok pro número de usuários que a plataforma tem hoje.
  const listRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
  })
  const listJson = await listRes.json()
  const user = (listJson.users ?? []).find((u) => u.email === EMAIL)
  if (!user) { console.error(`Usuário ${EMAIL} não encontrado`); process.exit(1) }

  const senha = novaSenha()
  const upRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: senha }),
  })
  if (!upRes.ok) { console.error('Falha ao atualizar senha:', await upRes.text()); process.exit(1) }

  console.log(`✅ Senha do superadmin (${EMAIL}) trocada.`)
  console.log(`Nova senha (salve agora, não será mostrada de novo): ${senha}`)
}

main()
```

- [ ] **Step 2: Rodar o script**

```bash
node scripts/rotate-superadmin-password.mjs
```
Expected: imprime `✅ Senha do superadmin ... trocada.` e a nova senha. **Salvar essa senha imediatamente num gerenciador de senhas** — ela não aparece de novo.

- [ ] **Step 3: Remover a senha em texto plano de `scripts/seed-fase0.mjs`**

Trocar:
```javascript
const TEST = {
  superEmail: 'leadfarma.br@gmail.com',
  superPass: 'Projetarcode321@',
  phSlug: 'farmacia-teste',
  phName: 'Farmácia Teste',
  phEmail: 'farmaciateste@leadfarma.br',
  phPass: 'FarmaciaTeste321@',
}
```
por:
```javascript
function gerarSenha() {
  return randomBytes(15).toString('base64url') + 'Aa1!'
}

const TEST = {
  superEmail: 'leadfarma.br@gmail.com',
  superPass: process.env.SEED_SUPER_PASSWORD || gerarSenha(),
  phSlug: 'farmacia-teste',
  phName: 'Farmácia Teste',
  phEmail: 'farmaciateste@leadfarma.br',
  phPass: process.env.SEED_PHARMACY_PASSWORD || gerarSenha(),
}
```
E adicionar o import no topo do arquivo (junto aos outros imports):
```javascript
import { randomBytes } from 'node:crypto'
```
E no final do `main()`, onde já imprime o resumo, adicionar as senhas geradas (pra quem rodar o seed conseguir logar):
```javascript
  console.log('\n✅ Seed concluído')
  console.log(`   super-admin:   ${TEST.superEmail}  (id ${superId})  senha: ${TEST.superPass}`)
  console.log(`   farmácia:      ${TEST.phSlug}  (id ${phId})`)
  console.log(`   admin farmácia:${TEST.phEmail}  (id ${phAdminId})  senha: ${TEST.phPass}`)
```

- [ ] **Step 4: Remover a senha em texto plano de `docs/05-SETUP-E-EXECUCAO.md`**

Trocar (linhas 72-73):
```
| **Gestão (super-admin)** | `/gestao` | `leadfarma.br@gmail.com` | `Projetarcode321@` |
| **Painel (farmácia teste)** | `/painel/login` | `farmaciateste@leadfarma.br` | `FarmaciaTeste321@` |
```
por:
```
| **Gestão (super-admin)** | `/gestao` | `leadfarma.br@gmail.com` | rotacionada — ver gerenciador de senhas da equipe |
| **Painel (farmácia teste)** | `/painel/login` | `farmaciateste@leadfarma.br` | gerada por `node scripts/seed-fase0.mjs` |
```

- [ ] **Step 5: Remover a senha em texto plano do plano histórico**

Em `docs/superpowers/plans/2026-07-07-leadfarma-fase-0-fundacao-multitenant.md`, trocar a linha 20:
```
- **Credenciais super-admin:** `leadfarma.br@gmail.com` / `Projetarcode321@`.
```
por:
```
- **Credenciais super-admin:** `leadfarma.br@gmail.com` / senha rotacionada em 2026-07-28 (ver `scripts/rotate-superadmin-password.mjs`).
```
E a linha 223:
```
  - cria usuário Auth `leadfarma.br@gmail.com` (senha `Projetarcode321@`, `email_confirm:true`) via `POST /auth/v1/admin/users` (service_role); insere `profiles(id=<uid>, pharmacy_id=null, role='superadmin')`.
```
por:
```
  - cria usuário Auth `leadfarma.br@gmail.com` (senha definida no momento da criação, `email_confirm:true`) via `POST /auth/v1/admin/users` (service_role); insere `profiles(id=<uid>, pharmacy_id=null, role='superadmin')`.
```

- [ ] **Step 6: Confirmar que não sobrou nenhuma ocorrência**

```bash
grep -rn "Projetarcode321\|FarmaciaTeste321" --include="*.md" --include="*.mjs" .
```
Expected: nenhum resultado.

- [ ] **Step 7: Commit**

```bash
git add scripts/rotate-superadmin-password.mjs scripts/seed-fase0.mjs docs/05-SETUP-E-EXECUCAO.md "docs/superpowers/plans/2026-07-07-leadfarma-fase-0-fundacao-multitenant.md"
git commit -m "fix(seguranca): remove senha em texto plano do repo, adiciona script de rotacao"
```

---

## Task 12: Atualizar Next.js para corrigir CVE de bypass de middleware

**Files:**
- Modify: `package.json`

**Interfaces:** nenhuma.

- [ ] **Step 1: Atualizar a dependência**

```bash
npm install next@16.2.11
```
(Se uma versão mais nova que `16.2.11` já estiver disponível na hora de rodar, instale a mais recente da série `16.x` — o requisito é só `>=16.2.11`, que corrige o CVE de bypass de middleware.)

- [ ] **Step 2: Rodar a suíte de testes**

Run: `npx vitest run`
Expected: todos os testes continuam passando (é um bump de patch/minor, sem breaking change esperado).

- [ ] **Step 3: Rodar o build**

Run: `npm run build`
Expected: build limpo, sem novos erros de tipo.

- [ ] **Step 4: Testar manualmente que o middleware ainda bloqueia acesso não autenticado**

```bash
npm run dev
```
Acessar `/painel` sem estar logado → deve redirecionar pra `/painel/login`. Acessar `/gestao` sem ser superadmin → deve bloquear.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(seguranca): atualiza Next.js para >=16.2.11 (CVE de bypass de middleware)"
```

---

## Task 13: Commitar a migration 0014 e os componentes de Realtime pendentes

**Files:**
- Adiciona ao Git (já existem em disco, criados numa sessão anterior): `supabase/migrations/0014_realtime_orders.sql`, `app/painel/pedidos/_components/pedidos-list.tsx`, `app/painel/pedidos/_components/pedido-card.tsx`.

**Interfaces:** nenhuma — só controle de versão.

- [ ] **Step 1: Confirmar que os arquivos existem e estão untracked**

```bash
git status --short
```
Expected: `??` na frente de `supabase/migrations/0014_realtime_orders.sql`, `app/painel/pedidos/_components/pedidos-list.tsx` e `app/painel/pedidos/_components/pedido-card.tsx`.

- [ ] **Step 2: Confirmar que a migration 0014 já foi aplicada no banco**

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
  body: JSON.stringify({ query: \"select tablename from pg_publication_tables where pubname = 'supabase_realtime'\" }),
}).then(r => r.json()).then(rows => console.log(JSON.stringify(rows)))
"
```
Expected: `[{"tablename":"orders"}]` — se não aparecer, rodar `node scripts/apply-migration.mjs supabase/migrations/0014_realtime_orders.sql` antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0014_realtime_orders.sql app/painel/pedidos/_components/pedidos-list.tsx app/painel/pedidos/_components/pedido-card.tsx
git commit -m "chore: commita migration 0014 (realtime de pedidos) e componentes pendentes de uma sessao anterior"
```

---

## Verificação final do Bloco 1

- [ ] `npx vitest run` — suíte inteira verde (testes novos desta plano + os já existentes).
- [ ] `npm run build` — build limpo.
- [ ] Rodar o fluxo completo manualmente: abrir `/f/<slug>`, montar carrinho, fechar pedido (reserva → criarPedido → comprovante) — confirma que zod + rate limit + checagem de farmácia ativa não quebraram o caminho feliz.
- [ ] Login no painel com a senha antiga do superadmin → deve falhar (senha rotacionada).
- [ ] `git log --oneline -15` — confirma que todos os commits das Tasks 1-13 estão presentes.
