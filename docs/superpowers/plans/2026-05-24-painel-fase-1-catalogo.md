# Painel Karolla Fit — Fase 1 (Catálogo Gerenciável) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a dona da loja cadastre/edite produtos (com código, 3 preços, foto e variações tamanho+cor com estoque) por um painel protegido, e fazer o site público ler esses dados do Supabase mostrando disponibilidade real.

**Architecture:** Supabase (Postgres + Auth + Storage) como fonte de dados. O app Next.js (App Router) lê produtos via uma camada de dados isolada (`lib/data/*`), o site público renderiza a partir dela, e o painel (`/painel`, autenticado) faz o CRUD. Nesta fase a disponibilidade = estoque físico (sem reserva ainda — isso vem na Fase 2).

**Tech Stack:** Next.js 16 (App Router) · `@supabase/supabase-js` + `@supabase/ssr` · Supabase (Postgres/Auth/Storage) · Vitest + @testing-library/react (testes) · shadcn/ui + Tailwind v4 · react-hook-form + zod (formulários).

**Spec de referência:** [docs/superpowers/specs/2026-05-24-painel-karolla-fit-design.md](../specs/2026-05-24-painel-karolla-fit-design.md)

---

## Estrutura de arquivos (o que será criado/alterado)

```
supabase/migrations/
  0001_schema_fase1.sql        # tabelas products, product_variants, store_settings + RLS + bucket
  0002_seed_produtos.sql       # insere os 12 produtos atuais + variações
lib/
  supabase/client.ts           # cliente browser (anon)
  supabase/server.ts           # cliente server (cookies, ssr)
  supabase/admin.ts            # cliente service-role (só server, ops privilegiadas)
  data/types.ts                # tipos: Product, ProductVariant, ProductWithVariants, etc.
  data/products.ts             # leitura de produtos (público + painel)
  data/products.helpers.ts     # helpers puros: preço por qtd, disponibilidade, agrega tamanhos/cores
lib/store.ts                   # MODIFICADO: CartItem.product passa a usar o tipo de lib/data/types
lib/products.ts                # REMOVIDO (substituído pela camada de dados)
app/page.tsx                   # passa a buscar do Supabase
components/product-card.tsx    # MODIFICADO: novo tipo, imageUrl, código, disponibilidade por variação
components/cart.tsx            # MODIFICADO: item.product.image → item.product.imageUrl
# (lib/data/settings.ts + edição de Configurações ficam para a Fase 2, junto do fluxo de WhatsApp)
app/painel/layout.tsx          # layout + proteção de auth
app/painel/login/page.tsx      # login
app/painel/page.tsx            # home do painel (Fase 1: atalho p/ Produtos)
app/painel/produtos/page.tsx   # lista de produtos
app/painel/produtos/_components/produto-form.tsx   # form criar/editar
app/painel/produtos/actions.ts # server actions: criar/editar/excluir/ativar
middleware.ts                  # refresh de sessão supabase
.env.local                     # chaves (NÃO commitado)
.env.example                   # modelo das chaves (commitado)
vitest.config.ts               # config de testes
vitest.setup.ts                # setup (jsdom/testing-library)
```

---

## Task 0: Setup manual do Supabase (passos do usuário)

> ⚠️ **Tarefa manual** — feita por você (Wesllei), uma vez. Não tem teste automatizado.

- [ ] **Step 1: Criar projeto no Supabase**

1. Acesse https://supabase.com → faça login → **New project**.
2. Nome: `karolla-fit`. Defina uma senha de banco forte (guarde). Região: a mais próxima (ex: South America / São Paulo).
3. Aguarde o provisionamento (~2 min).

- [ ] **Step 2: Copiar as chaves**

Em **Project Settings → API**, copie:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secreta, só server)

- [ ] **Step 3: Criar o usuário admin (a dona da loja)**

Em **Authentication → Users → Add user → Create new user**: defina e-mail e senha dela. (Sem confirmação por e-mail nesta fase.)

- [ ] **Step 4: Confirmar com o assistente**

Avise que o projeto está criado e as chaves em mãos, para seguir para a Task 1.

---

## Task 1: Variáveis de ambiente

**Files:**
- Create: `.env.local` (NÃO commitar)
- Create: `.env.example` (commitar)
- Modify: `.gitignore` (garantir que `.env*.local` está ignorado)

- [ ] **Step 1: Criar `.env.example`**

```bash
# Supabase (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

- [ ] **Step 2: Criar `.env.local`** com os valores reais copiados na Task 0.

- [ ] **Step 3: Confirmar `.gitignore`**

Verifique que existe a linha `.env*.local` (o template Next.js já inclui). Se não, adicione.

- [ ] **Step 4: Commit** (apenas o `.env.example` e `.gitignore`)

```bash
git add .env.example .gitignore
git commit -m "chore: env vars do supabase (example)"
```

---

## Task 2: Schema do banco (migration 0001)

**Files:**
- Create: `supabase/migrations/0001_schema_fase1.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0001_schema_fase1.sql

-- PRODUTOS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default '',
  description text not null default '',
  image_url text,
  price_cost numeric(10,2) not null default 0,
  price_wholesale numeric(10,2) not null default 0,
  price_retail numeric(10,2) not null default 0,
  min_wholesale int not null default 1,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- VARIAÇÕES (tamanho + cor)
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  stock int not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);

-- CONFIGURAÇÕES DA LOJA (linha única)
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'Karolla Fit',
  whatsapp_number text not null default '',
  reservation_minutes int not null default 10,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- VIEW PÚBLICA SEGURA (sem custo; expõe disponibilidade = estoque na Fase 1)
-- security_invoker = false: view roda como dono → anon lê pelas views sem
-- policy nas tabelas base; o RLS continua protegendo acesso direto.
create view public.public_product_variants
  with (security_invoker = false) as
  select id, product_id, size, color, (stock > 0) as available
  from public.product_variants;

create view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order
  from public.products
  where active = true;

-- RLS
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_settings enable row level security;

-- Autenticado (admin) faz tudo
create policy "admin all products" on public.products
  for all to authenticated using (true) with check (true);
create policy "admin all variants" on public.product_variants
  for all to authenticated using (true) with check (true);
create policy "admin all settings" on public.store_settings
  for all to authenticated using (true) with check (true);

-- Anon pode ler settings (precisa do whatsapp/nome no site)
create policy "anon read settings" on public.store_settings
  for select to anon using (true);

-- As views public_* rodam com privilégios do dono (security definer por padrão em views),
-- então o anon lê produtos ativos/disponibilidade sem acessar as tabelas base.
grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;
```

- [ ] **Step 2: Rodar no Supabase**

No painel do Supabase → **SQL Editor** → cole o conteúdo do arquivo → **Run**. Confirme "Success".

- [ ] **Step 3: Criar o bucket de imagens**

Em **Storage → New bucket**: nome `produtos`, **Public bucket = ON** (leitura pública). Salvar.

- [ ] **Step 4: Verificar**

No SQL Editor rode: `select * from public.store_settings;` → deve retornar 1 linha.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_schema_fase1.sql
git commit -m "feat(db): schema fase 1 (products, variants, settings, rls)"
```

---

## Task 3: Dependências e cliente Supabase

**Files:**
- Modify: `package.json` (deps)
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `middleware.ts`

- [ ] **Step 1: Instalar libs**

Run: `pnpm add @supabase/supabase-js @supabase/ssr`
Expected: adiciona as duas dependências sem erro.

- [ ] **Step 2: Cliente browser**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Cliente server**

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // chamado de Server Component: ignorável (middleware renova a sessão)
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Cliente admin (service-role, só server)**

```ts
// lib/supabase/admin.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Use SOMENTE em código de servidor (server actions / route handlers). Nunca importar em client component.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 5: Middleware (renova sessão)**

```ts
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/painel/:path*'],
}
```

- [ ] **Step 6: Verificar build**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros de tipo nos arquivos novos.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml lib/supabase middleware.ts
git commit -m "feat: clientes supabase (browser/server/admin) + middleware"
```

---

## Task 4: Setup de testes (Vitest)

**Files:**
- Modify: `package.json` (devDeps + scripts)
- Create: `vitest.config.ts`, `vitest.setup.ts`

- [ ] **Step 1: Instalar**

Run: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`

- [ ] **Step 2: Config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Adicionar script de teste no `package.json`**

Em `"scripts"`, acrescentar: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Smoke test**

```ts
// lib/data/products.helpers.test.ts (temporário, só pra validar setup)
import { describe, it, expect } from 'vitest'
describe('setup', () => {
  it('roda', () => { expect(1 + 1).toBe(2) })
})
```

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts
git commit -m "chore: setup vitest + testing-library"
```

---

## Task 5: Tipos e helpers puros (TDD)

**Files:**
- Create: `lib/data/types.ts`, `lib/data/products.helpers.ts`
- Test: `lib/data/products.helpers.test.ts` (substitui o smoke test)

- [ ] **Step 1: Tipos**

```ts
// lib/data/types.ts
export interface ProductVariant {
  id: string
  productId: string
  size: string
  color: string
  stock: number
}

export interface Product {
  id: string
  code: string
  name: string
  category: string
  description: string
  imageUrl: string | null
  priceCost: number
  priceWholesale: number
  priceRetail: number
  minWholesale: number
  active: boolean
  sortOrder: number
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[]
}
```

- [ ] **Step 2: Escrever os testes dos helpers (devem falhar)**

```ts
// lib/data/products.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { priceForQuantity, sizesOf, colorsOf, isVariantAvailable } from './products.helpers'
import type { ProductWithVariants } from './types'

const p: ProductWithVariants = {
  id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  imageUrl: null, priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9,
  minWholesale: 6, active: true, sortOrder: 0,
  variants: [
    { id: 'v1', productId: '1', size: 'M', color: 'Preto', stock: 3 },
    { id: 'v2', productId: '1', size: 'G', color: 'Preto', stock: 0 },
    { id: 'v3', productId: '1', size: 'M', color: 'Rosa', stock: 5 },
  ],
}

describe('priceForQuantity', () => {
  it('usa varejo abaixo do mínimo de atacado', () => {
    expect(priceForQuantity(p, 5)).toBe(89.9)
  })
  it('usa atacado a partir do mínimo', () => {
    expect(priceForQuantity(p, 6)).toBe(49.9)
  })
})

describe('sizesOf / colorsOf', () => {
  it('lista tamanhos distintos', () => {
    expect(sizesOf(p)).toEqual(['M', 'G'])
  })
  it('lista cores distintas', () => {
    expect(colorsOf(p)).toEqual(['Preto', 'Rosa'])
  })
})

describe('isVariantAvailable', () => {
  it('true quando há estoque', () => {
    expect(isVariantAvailable(p, 'M', 'Preto')).toBe(true)
  })
  it('false quando estoque 0', () => {
    expect(isVariantAvailable(p, 'G', 'Preto')).toBe(false)
  })
  it('false quando combinação não existe', () => {
    expect(isVariantAvailable(p, 'GG', 'Azul')).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `pnpm test products.helpers`
Expected: FAIL (`priceForQuantity is not a function` / módulo não encontrado).

- [ ] **Step 4: Implementar**

```ts
// lib/data/products.helpers.ts
import type { ProductWithVariants } from './types'

export function priceForQuantity(p: ProductWithVariants, qty: number): number {
  return qty >= p.minWholesale ? p.priceWholesale : p.priceRetail
}

export function sizesOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.size))]
}

export function colorsOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.color))]
}

export function isVariantAvailable(p: ProductWithVariants, size: string, color: string): boolean {
  const v = p.variants.find((x) => x.size === size && x.color === color)
  return !!v && v.stock > 0
}
```

- [ ] **Step 5: Rodar (deve passar)**

Run: `pnpm test products.helpers`
Expected: PASS (todos os casos).

- [ ] **Step 6: Commit**

```bash
git add lib/data/types.ts lib/data/products.helpers.ts lib/data/products.helpers.test.ts
git commit -m "feat(data): tipos e helpers de produto (preço/disponibilidade) com testes"
```

---

## Task 6: Camada de leitura de produtos + mapeamento (TDD do mapper)

**Files:**
- Create: `lib/data/products.ts`, `lib/data/mappers.ts`
- Test: `lib/data/mappers.test.ts`

- [ ] **Step 1: Teste do mapper (snake_case do DB → camelCase do app)**

```ts
// lib/data/mappers.test.ts
import { describe, it, expect } from 'vitest'
import { mapProductRow, mapVariantRow } from './mappers'

describe('mapVariantRow', () => {
  it('mapeia campos', () => {
    expect(mapVariantRow({ id: 'v1', product_id: '1', size: 'M', color: 'Preto', stock: 3 }))
      .toEqual({ id: 'v1', productId: '1', size: 'M', color: 'Preto', stock: 3 })
  })
})

describe('mapProductRow', () => {
  it('mapeia campos e números', () => {
    const row = {
      id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
      image_url: null, price_cost: '20.00', price_wholesale: '49.90', price_retail: '89.90',
      min_wholesale: 6, active: true, sort_order: 0,
    }
    expect(mapProductRow(row)).toMatchObject({
      id: '1', code: 'LEG-001', priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9,
      minWholesale: 6, imageUrl: null,
    })
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test mappers`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar mappers**

```ts
// lib/data/mappers.ts
import type { Product, ProductVariant } from './types'

export function mapVariantRow(r: any): ProductVariant {
  return { id: r.id, productId: r.product_id, size: r.size, color: r.color, stock: r.stock }
}

export function mapProductRow(r: any): Product {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category ?? '',
    description: r.description ?? '',
    imageUrl: r.image_url ?? null,
    priceCost: Number(r.price_cost ?? 0),
    priceWholesale: Number(r.price_wholesale ?? 0),
    priceRetail: Number(r.price_retail ?? 0),
    minWholesale: Number(r.min_wholesale ?? 1),
    active: r.active ?? true,
    sortOrder: Number(r.sort_order ?? 0),
  }
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test mappers`
Expected: PASS.

- [ ] **Step 5: Implementar leitura (sem teste unitário — depende do Supabase; validado manualmente na Task 8)**

```ts
// lib/data/products.ts
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapProductRow, mapVariantRow } from './mappers'
import type { ProductWithVariants } from './types'

// PÚBLICO: produtos ativos + variações (via tabelas base; RLS/anon liberado p/ select de produtos? ver nota)
// Nesta fase, leitura pública usa o cliente server (anon) lendo as VIEWS public_*.
export async function getPublicProducts(): Promise<ProductWithVariants[]> {
  const supabase = await createServerClient()
  const { data: products, error } = await supabase
    .from('public_products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error

  const ids = products.map((p) => p.id)
  const { data: variants, error: vErr } = await supabase
    .from('public_product_variants')
    .select('*')
    .in('product_id', ids)
  if (vErr) throw vErr

  return products.map((p) => ({
    ...mapProductRow({ ...p, price_cost: 0, active: true }),
    variants: variants
      .filter((v) => v.product_id === p.id)
      // a view pública expõe `available`; convertendo p/ stock binário (1/0) nesta fase
      .map((v) => mapVariantRow({ ...v, stock: v.available ? 1 : 0 })),
  }))
}

// PAINEL (admin): produtos completos com custo e estoque exato. Usa service-role no server.
export async function getAdminProducts(): Promise<ProductWithVariants[]> {
  const supabase = createAdminClient()
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error

  const { data: variants, error: vErr } = await supabase
    .from('product_variants')
    .select('*')
  if (vErr) throw vErr

  return products.map((p) => ({
    ...mapProductRow(p),
    variants: variants.filter((v) => v.product_id === p.id).map(mapVariantRow),
  }))
}

export async function getAdminProduct(id: string): Promise<ProductWithVariants | null> {
  const supabase = createAdminClient()
  const { data: p } = await supabase.from('products').select('*').eq('id', id).single()
  if (!p) return null
  const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', id)
  return { ...mapProductRow(p), variants: (variants ?? []).map(mapVariantRow) }
}
```

> **Nota de design:** o site público (anon) lê pelas **views** `public_*` (sem custo/estoque exato). O painel lê pelas tabelas base com **service-role** dentro de Server Components/Actions protegidos por auth.

- [ ] **Step 6: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/data/mappers.ts lib/data/mappers.test.ts lib/data/products.ts
git commit -m "feat(data): leitura de produtos (público/admin)"
```

---

## Task 7: Seed dos 12 produtos atuais (migration 0002)

**Files:**
- Create: `supabase/migrations/0002_seed_produtos.sql`

- [ ] **Step 1: Gerar o SQL de seed**

A partir de [lib/products.ts](../../../lib/products.ts), criar um INSERT por produto + as variações (cartesiano `sizes` × `colors`) com um estoque inicial (ex: 5). Código sugerido: prefixo da categoria + número (ex: `LEG-001`). Custo inicial = 0 (ela ajusta depois). Exemplo dos 2 primeiros (replicar para os 12):

```sql
-- supabase/migrations/0002_seed_produtos.sql
with p1 as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('LEG-001', 'Legging Suplex Premium', 'Leggings',
    'Legging de alta compressão com tecido suplex premium. Cintura alta que modela o corpo.',
    'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=500&fit=crop',
    0, 49.90, 89.90, 6, 1)
  returning id
)
insert into public.product_variants (product_id, size, color, stock)
select p1.id, s.size, c.color, 5
from p1, unnest(array['P','M','G','GG']) as s(size),
        unnest(array['Preto','Cinza','Azul Marinho']) as c(color);

with p2 as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('TOP-001', 'Top Nadador Fitness', 'Tops',
    'Top nadador com sustentação média-alta. Ideal para treinos intensos.',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop',
    0, 34.90, 59.90, 10, 2)
  returning id
)
insert into public.product_variants (product_id, size, color, stock)
select p2.id, s.size, c.color, 5
from p2, unnest(array['P','M','G','GG']) as s(size),
        unnest(array['Preto','Rosa','Verde Neon']) as c(color);

-- ... replicar p3..p12 com os dados de lib/products.ts ...
```

> O implementador deve completar p3..p12 a partir de `lib/products.ts` (códigos: `CONJ-001`, `SHORT-001`, `REG-001`, `CALC-001`, `BODY-001`, `BERM-001`, `JAQ-001`, `CROP-001`, `LEG-002`, `TOP-002`).

- [ ] **Step 2: Rodar no SQL Editor do Supabase** → confirmar "Success".

- [ ] **Step 3: Verificar**

Run no SQL Editor: `select count(*) from public.products;` → **12**. `select count(*) from public.product_variants;` → soma das variações (ex: 12 produtos × ~12 = ~144).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_seed_produtos.sql
git commit -m "feat(db): seed dos 12 produtos iniciais"
```

---

## Task 8: Site público lendo do Supabase (+ reconciliar carrinho)

**Files:**
- Modify: `lib/store.ts`
- Modify: `app/page.tsx`
- Modify: `components/product-card.tsx`
- Modify: `components/cart.tsx`
- Delete: `lib/products.ts`

> **Contexto importante** (já verificado no código atual): `components/product-card.tsx` importa `Product` de `@/lib/store` e usa `product.sizes`, `product.colors`, `product.image`, `product.priceWholesale/priceRetail`, `product.minWholesale`. `components/cart.tsx` usa `item.product.image` (linha ~352). O tipo antigo (`lib/store.ts`) tem `image`/`sizes[]`/`colors[]`; o novo (`lib/data/types.ts`) tem `imageUrl` + `variants`. Esta task reconcilia tudo no tipo novo.

- [ ] **Step 1: Ler `app/page.tsx` e `components/category-filter.tsx`** para ver como `products`/`categories` são importados e passados (hoje vêm de `@/lib/products`).

- [ ] **Step 2: `lib/store.ts` passa a usar o tipo de dados**

Substituir a interface `Product` local por um import do tipo da camada de dados, mantendo `CartItem`/`CartStore` (os campos usados — `id`, `name`, `imageUrl`, `priceWholesale`, `priceRetail` — existem no novo tipo):

```ts
// lib/store.ts (topo)
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/lib/data/types'

export type { Product }

export interface CartItem {
  product: Product
  quantity: number
  size: string
  color: string
  priceType: 'retail' | 'wholesale'
}
// ... resto do arquivo (CartStore + useCartStore) permanece igual ...
```

- [ ] **Step 3: `app/page.tsx` busca do Supabase (Server Component)**

Tornar a página `async` Server Component: chamar `getPublicProducts()`, derivar `const categories = ['Todos', ...new Set(produtos.map(p => p.category))]`, e passar `produtos`/`categories` para os mesmos componentes de hoje. Remover o import de `@/lib/products`. Se a página atual for client component com estado de filtro, extrair o filtro para um componente client filho que recebe `produtos`/`categories` como props (a busca de dados fica no Server Component pai).

- [ ] **Step 4: `components/product-card.tsx` — novo tipo + código + disponibilidade**

Trocar o tipo e a fonte de tamanhos/cores/imagem:

```ts
// imports
import type { ProductWithVariants } from '@/lib/data/types'
import { sizesOf, colorsOf, isVariantAvailable } from '@/lib/data/products.helpers'

interface ProductCardProps {
  product: ProductWithVariants
  index: number
}
```

Dentro do componente:
- `const sizes = sizesOf(product)` e `const colors = colorsOf(product)` (no lugar de `product.sizes`/`product.colors`).
- Imagem: `product.imageUrl ?? '/placeholder.jpg'` (no lugar de `product.image`).
- Estados iniciais: `useState(sizes[0])` / `useState(colors[0])`.
- **Código:** adicionar um badge pequeno com `Cód: {product.code}` (ex: ao lado da categoria).
- **Disponibilidade:** o botão de cada tamanho/cor deve checar `isVariantAvailable(product, size, color)` — variação sem estoque fica `disabled` e com estilo apagado + risco. Se nenhuma variação tiver estoque (`sizes.every(...)`/`colors.every(...)`), trocar o botão "Adicionar" por um "Esgotado" desabilitado.

- [ ] **Step 5: `components/cart.tsx` — imageUrl**

Trocar a linha da imagem (atual `src={item.product.image}`) por:

```tsx
<img
  src={item.product.imageUrl ?? '/placeholder.jpg'}
  alt={item.product.name}
  className="h-full w-full object-cover"
/>
```

> O número do WhatsApp segue como está (placeholder `5500000000000`) nesta fase — a configuração do número real e a reserva entram na Fase 2.

- [ ] **Step 6: Remover o arquivo estático**

Run: `git rm lib/products.ts`
Corrigir qualquer import remanescente de `@/lib/products` (buscar com `grep -rn "@/lib/products" app components`).

- [ ] **Step 7: Verificar tipos + rodar o site**

Run: `pnpm exec tsc --noEmit` → sem erros.
Run: `grep -rn "@/lib/products\"" app components` → sem resultados (só a nova `@/lib/data/...`).
Abrir http://localhost:3001 → os 12 produtos aparecem **vindos do banco**, com código; ao zerar o estoque de uma variação no SQL Editor e recarregar, o tamanho/cor aparece "esgotado".

- [ ] **Step 8: Commit**

```bash
git add lib/store.ts app/page.tsx components/product-card.tsx components/cart.tsx
git commit -m "feat(site): produtos do supabase, código e disponibilidade; carrinho no novo tipo"
```

---

## Task 9: Autenticação do painel (login + proteção)

**Files:**
- Create: `app/painel/login/page.tsx`, `app/painel/login/actions.ts`
- Create: `app/painel/layout.tsx`
- Create: `app/painel/page.tsx`

- [ ] **Step 1: Server action de login**

```ts
// app/painel/login/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
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

- [ ] **Step 2: Página de login**

Form simples (e-mail + senha) que chama a action `login`. Mostrar mensagem se `searchParams.erro`. Usar componentes shadcn `Input`/`Button`/`Label` já presentes.

- [ ] **Step 3: Layout protegido**

```tsx
// app/painel/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // login é a única rota do /painel acessível sem user — o middleware + esta checagem cobrem o resto
  if (!user) {
    // Permitir a própria página de login renderizar
    // (a página de login não usa este layout porque está em /painel/login com seu próprio retorno)
  }
  return <div className="min-h-screen bg-background">{children}</div>
}
```

> **Padrão de proteção:** cada página dentro de `/painel` (exceto `/painel/login`) chama `getUser()` no topo e faz `redirect('/painel/login')` se não houver usuário. (Mais explícito e confiável que depender só do layout.)

- [ ] **Step 4: Home do painel**

```tsx
// app/painel/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function PainelHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Painel Karolla Fit</h1>
      <Link href="/painel/produtos" className="underline">Gerenciar produtos →</Link>
    </div>
  )
}
```

- [ ] **Step 5: Verificar manualmente**

Acessar http://localhost:3001/painel → deve redirecionar para `/painel/login`. Logar com o usuário criado na Task 0 → cai em `/painel`.

- [ ] **Step 6: Commit**

```bash
git add app/painel/login app/painel/layout.tsx app/painel/page.tsx
git commit -m "feat(painel): autenticação (login/logout) e proteção de rotas"
```

---

## Task 10: Lista de produtos no painel

**Files:**
- Create: `app/painel/produtos/page.tsx`

- [ ] **Step 1: Página de lista**

Server Component: checa `getUser()` (redirect se não logado), chama `getAdminProducts()`, e renderiza uma tabela com: mini foto (`image_url`), código, nome, categoria, preços (custo/atacado/varejo), estoque total (soma das variações), status ativo/inativo, e link "Editar" (`/painel/produtos/[id]`). Botão "Novo produto" (`/painel/produtos/novo`).

- [ ] **Step 2: Verificar manualmente**

Abrir `/painel/produtos` logado → lista os 12 produtos com estoque total correto.

- [ ] **Step 3: Commit**

```bash
git add app/painel/produtos/page.tsx
git commit -m "feat(painel): lista de produtos"
```

---

## Task 11: Validação do formulário de produto (TDD)

**Files:**
- Create: `app/painel/produtos/_components/produto-schema.ts`
- Test: `app/painel/produtos/_components/produto-schema.test.ts`

- [ ] **Step 1: Teste do schema (zod)**

```ts
// app/painel/produtos/_components/produto-schema.test.ts
import { describe, it, expect } from 'vitest'
import { produtoSchema } from './produto-schema'

const valido = {
  code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, minWholesale: 6,
  active: true,
  variants: [{ size: 'M', color: 'Preto', stock: 3 }],
}

describe('produtoSchema', () => {
  it('aceita produto válido', () => {
    expect(produtoSchema.safeParse(valido).success).toBe(true)
  })
  it('rejeita código vazio', () => {
    expect(produtoSchema.safeParse({ ...valido, code: '' }).success).toBe(false)
  })
  it('rejeita sem variações', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [] }).success).toBe(false)
  })
  it('rejeita estoque negativo', () => {
    expect(produtoSchema.safeParse({ ...valido, variants: [{ size: 'M', color: 'Preto', stock: -1 }] }).success).toBe(false)
  })
  it('rejeita preço negativo', () => {
    expect(produtoSchema.safeParse({ ...valido, priceRetail: -5 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test produto-schema`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar o schema**

```ts
// app/painel/produtos/_components/produto-schema.ts
import { z } from 'zod'

export const variantSchema = z.object({
  size: z.string().min(1, 'Tamanho obrigatório'),
  color: z.string().min(1, 'Cor obrigatória'),
  stock: z.number().int().min(0, 'Estoque não pode ser negativo'),
})

export const produtoSchema = z.object({
  code: z.string().min(1, 'Código obrigatório'),
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().default(''),
  description: z.string().default(''),
  priceCost: z.number().min(0),
  priceWholesale: z.number().min(0),
  priceRetail: z.number().min(0),
  minWholesale: z.number().int().min(1),
  active: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, 'Adicione ao menos uma variação'),
})

export type ProdutoInput = z.infer<typeof produtoSchema>
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test produto-schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/_components/produto-schema.ts app/painel/produtos/_components/produto-schema.test.ts
git commit -m "feat(painel): schema de validação do produto com testes"
```

---

## Task 12: Server actions de produto (criar/editar/excluir/ativar)

**Files:**
- Create: `app/painel/produtos/actions.ts`

- [ ] **Step 1: Implementar as actions**

```ts
// app/painel/produtos/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { produtoSchema, type ProdutoInput } from './_components/produto-schema'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
}

export async function createProduto(input: ProdutoInput) {
  await requireUser()
  const data = produtoSchema.parse(input)
  const db = createAdminClient()
  const { data: prod, error } = await db.from('products').insert({
    code: data.code, name: data.name, category: data.category, description: data.description,
    price_cost: data.priceCost, price_wholesale: data.priceWholesale, price_retail: data.priceRetail,
    min_wholesale: data.minWholesale, active: data.active,
  }).select('id').single()
  if (error) throw error
  const variantsRows = data.variants.map((v) => ({
    product_id: prod.id, size: v.size, color: v.color, stock: v.stock,
  }))
  const { error: vErr } = await db.from('product_variants').insert(variantsRows)
  if (vErr) throw vErr
  revalidatePath('/painel/produtos')
  revalidatePath('/')
  return prod.id as string
}

export async function updateProduto(id: string, input: ProdutoInput) {
  await requireUser()
  const data = produtoSchema.parse(input)
  const db = createAdminClient()
  await db.from('products').update({
    code: data.code, name: data.name, category: data.category, description: data.description,
    price_cost: data.priceCost, price_wholesale: data.priceWholesale, price_retail: data.priceRetail,
    min_wholesale: data.minWholesale, active: data.active, updated_at: new Date().toISOString(),
  }).eq('id', id)
  // Estratégia simples e segura na Fase 1: troca todas as variações
  await db.from('product_variants').delete().eq('product_id', id)
  await db.from('product_variants').insert(
    data.variants.map((v) => ({ product_id: id, size: v.size, color: v.color, stock: v.stock }))
  )
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function setProdutoActive(id: string, active: boolean) {
  await requireUser()
  const db = createAdminClient()
  await db.from('products').update({ active }).eq('id', id)
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function deleteProduto(id: string) {
  await requireUser()
  const db = createAdminClient()
  await db.from('products').delete().eq('id', id) // variações caem por ON DELETE CASCADE
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function uploadProdutoImage(file: File): Promise<string> {
  await requireUser()
  const db = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await db.storage.from('produtos').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = db.storage.from('produtos').getPublicUrl(path)
  return data.publicUrl
}
```

> **Nota:** `updateProduto` recria as variações por simplicidade na Fase 1. A edição granular de estoque por variação (sem recriar) será refinada na Fase 3 junto com `stock_movements`.

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/painel/produtos/actions.ts
git commit -m "feat(painel): server actions de produto (CRUD + upload de imagem)"
```

---

## Task 13: Formulário de produto (criar/editar) na UI

**Files:**
- Create: `app/painel/produtos/_components/produto-form.tsx`
- Create: `app/painel/produtos/novo/page.tsx`
- Create: `app/painel/produtos/[id]/page.tsx`

- [ ] **Step 1: Componente de formulário (client)**

`produto-form.tsx` ('use client') usando `react-hook-form` + `zodResolver(produtoSchema)`:
- Campos: código, nome, categoria, descrição, custo, atacado, varejo, qtd mín. atacado, switch ativo.
- **Upload de foto**: input file → chama `uploadProdutoImage` → guarda a URL retornada e mostra preview.
- **Grade de variações**: `useFieldArray` para adicionar/remover linhas (tamanho, cor, estoque).
- Botão salvar → chama `createProduto` (novo) ou `updateProduto` (edição) e redireciona para `/painel/produtos`.
- Mostrar erros de validação por campo.

- [ ] **Step 2: Página "novo"**

```tsx
// app/painel/produtos/novo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProdutoForm } from '../_components/produto-form'

export default async function NovoProduto() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  return <ProdutoForm mode="create" />
}
```

- [ ] **Step 3: Página "editar"**

```tsx
// app/painel/produtos/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getAdminProduct } from '@/lib/data/products'
import { ProdutoForm } from '../_components/produto-form'

export default async function EditarProduto({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const { id } = await params
  const produto = await getAdminProduct(id)
  if (!produto) notFound()
  return <ProdutoForm mode="edit" produto={produto} />
}
```

- [ ] **Step 4: Verificar manualmente o fluxo completo**

1. `/painel/produtos/novo` → preencher, subir foto, adicionar 2 variações, salvar → aparece na lista e no site (`/`).
2. Editar um produto → mudar preço e estoque → reflete na lista e no site.
3. Desativar um produto → some do site, continua na lista do painel.
4. Excluir um produto de teste → some de ambos.

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/_components/produto-form.tsx app/painel/produtos/novo app/painel/produtos/[id]
git commit -m "feat(painel): formulário de criar/editar produto com variações e upload"
```

---

## Task 14: Botões de ação na lista (ativar/desativar/excluir) + logout

**Files:**
- Modify: `app/painel/produtos/page.tsx`
- Create: `app/painel/produtos/_components/produto-actions.tsx`
- Modify: `app/painel/page.tsx` (botão sair)

- [ ] **Step 1: Componente client de ações por linha**

`produto-actions.tsx` ('use client'): switch ativo/inativo → `setProdutoActive`; botão excluir com confirmação (`AlertDialog` do shadcn) → `deleteProduto`.

- [ ] **Step 2: Botão "Sair" no painel** chamando a action `logout`.

- [ ] **Step 3: Verificar manualmente** ativar/desativar e excluir pela lista; sair encerra a sessão.

- [ ] **Step 4: Commit**

```bash
git add app/painel/produtos/page.tsx app/painel/produtos/_components/produto-actions.tsx app/painel/page.tsx
git commit -m "feat(painel): ações de ativar/desativar/excluir e logout"
```

---

## Task 15: Verificação final da Fase 1

- [ ] **Step 1: Suite de testes**

Run: `pnpm test`
Expected: todos os testes (helpers, mappers, produto-schema) PASS.

- [ ] **Step 2: Tipos + lint**

Run: `pnpm exec tsc --noEmit` (sem erros). Run: `pnpm lint` (sem erros novos).

- [ ] **Step 3: Checklist funcional (manual)**

- [ ] Site público lista produtos do Supabase, com código e disponibilidade por variação.
- [ ] Produto inativo não aparece no site.
- [ ] Login protege todas as rotas `/painel/*`.
- [ ] Criar/editar/excluir/ativar produto funciona e reflete no site.
- [ ] Upload de foto funciona e a imagem aparece no site.
- [ ] Estoque por variação é salvo e exibido (esgotado quando 0).

- [ ] **Step 4: Commit final / tag**

```bash
git add -A
git commit -m "chore: fase 1 (catálogo gerenciável) concluída"
```

---

## Notas para a Fase 2 (não implementar agora)

- Tabelas `orders`/`order_items`, RPCs de reserva (`create_order`, `complete_order`, `cancel_order`, `redo_order`, `expire_orders`), pg_cron, Realtime no painel de Pedidos, e mudança do envio do site para reservar estoque antes do WhatsApp. A disponibilidade pública passará a descontar reservas (a view `public_product_variants` será atualizada).
- **`lib/data/settings.ts`** (`getStoreSettings`) + tela de **Configurações** no painel (nome da loja, **número do WhatsApp**, minutos de reserva). O `cart.tsx` passará a usar o número configurado em vez do placeholder `5500000000000`.
