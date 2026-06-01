# Painel de catálogo, peso, envio/pagamento e checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir montar o catálogo do zero (categorias gerenciadas, vitrine limpa, peso por produto) e fechar pedidos completos pelo celular (formas de envio/pagamento criadas no painel, total com frete e acréscimo, pedido detalhado no WhatsApp).

**Architecture:** Next.js App Router + Supabase. Migrations novas (0005–0009) adicionam peso, categorias, formas de envio/pagamento e colunas de pedido. A camada `lib/data` ganha módulos e helpers puros (testáveis). Server actions com `requireUser()` fazem o CRUD via service-role. O cálculo do total é refeito no servidor dentro de `buildOrder`/`criarPedido`. UI responsiva (mobile-first).

**Tech Stack:** TypeScript, Next.js (Server Components + Server Actions), Supabase JS, Zod, react-hook-form, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-01-painel-catalogo-checkout-design.md`

---

## File Structure

**Migrations (criar):**
- `supabase/migrations/0005_peso_e_limpeza.sql`
- `supabase/migrations/0006_categorias.sql`
- `supabase/migrations/0007_formas_envio.sql`
- `supabase/migrations/0008_formas_pagamento.sql`
- `supabase/migrations/0009_pedido_envio_pagamento.sql`

**Camada de dados (criar/modificar):**
- Modificar: `lib/data/types.ts` (Product.weightGrams)
- Modificar: `lib/data/mappers.ts` (lê weight_grams)
- Modificar: `lib/data/products.helpers.ts` (+ `shouldRenderAsButtons`)
- Modificar: `lib/data/order.helpers.ts` (buildOrder com envio/pagamento/peso)
- Modificar: `lib/data/orders.types.ts` (campos novos no pedido/item)
- Modificar: `lib/data/orders.ts` (mapeia campos novos)
- Criar: `lib/data/categories.ts`
- Criar: `lib/data/shipping.ts`
- Criar: `lib/data/payment.ts`

**Admin (criar/modificar):**
- Criar: `app/painel/categorias/page.tsx`, `actions.ts`, `_components/categorias-manager.tsx`
- Criar: `app/painel/envio/page.tsx`, `actions.ts`, `_components/envio-manager.tsx`
- Criar: `app/painel/pagamento/page.tsx`, `actions.ts`, `_components/pagamento-manager.tsx`
- Modificar: `app/painel/page.tsx` (links novos)
- Modificar: `app/painel/produtos/_components/produto-schema.ts` (weightGrams)
- Modificar: `app/painel/produtos/_components/produto-form.tsx` (peso, dropdown categoria, label, mobile)
- Modificar: `app/painel/produtos/actions.ts` (grava weight_grams)
- Modificar: `app/painel/produtos/novo/page.tsx` e `[id]/page.tsx` (passa categorias)
- Modificar: `app/painel/produtos/page.tsx` (lista responsiva)
- Modificar: `app/painel/pedidos/page.tsx` (peso/envio/pagamento/total)

**Público (modificar):**
- `components/product-card.tsx` (vitrine limpa)
- `components/cart.tsx` (seletores envio/pagamento, total, mensagem detalhada)
- `app/_components/catalog.tsx` (repassa métodos)
- `app/page.tsx` (carrega métodos ativos)
- `app/_actions/criar-pedido.ts` (resolve envio/pagamento do banco)

**Testes (criar/modificar):**
- `lib/data/products.helpers.test.ts` (+ shouldRenderAsButtons)
- `lib/data/order.helpers.test.ts` (+ peso/frete/acréscimo)

---

## Phase 1 — Banco de dados

### Task 1: Migration de peso + limpeza dos dados de exemplo

**Files:**
- Create: `supabase/migrations/0005_peso_e_limpeza.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0005_peso_e_limpeza.sql

-- peso por produto (gramas) e snapshot no item do pedido
alter table public.products
  add column weight_grams int not null default 0;

alter table public.order_items
  add column weight_grams int not null default 0;

-- expor weight_grams na view pública (recriar mantendo as colunas existentes)
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams
  from public.products
  where active = true;

-- limpeza dos dados de exemplo (pedidos antigos NÃO são afetados:
-- order_items.product_id não tem FK e mantém o snapshot)
delete from public.product_variants;
delete from public.products;
```

- [ ] **Step 2: Aplicar e verificar**

Run: `cd "supabase" && supabase db push` (ou aplique o SQL no painel do Supabase, conforme o fluxo do projeto)
Expected: sem erro; `select count(*) from products;` retorna 0.

> Se o projeto aplica migrations por outro caminho (ex: copiar/colar no SQL editor do Supabase), siga esse caminho. O importante é o arquivo versionado existir.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_peso_e_limpeza.sql
git commit -m "feat(db): peso por produto e limpeza dos dados de exemplo"
```

---

### Task 2: Migration de categorias

**Files:**
- Create: `supabase/migrations/0006_categorias.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0006_categorias.sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
create policy "admin all categories" on public.categories
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Aplicar e verificar**

Run: aplicar a migration no Supabase.
Expected: `select * from categories;` retorna 0 linhas, sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_categorias.sql
git commit -m "feat(db): tabela de categorias gerenciadas"
```

---

### Task 3: Migration de formas de envio

**Files:**
- Create: `supabase/migrations/0007_formas_envio.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0007_formas_envio.sql
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_methods enable row level security;
create policy "admin all shipping" on public.shipping_methods
  for all to authenticated using (true) with check (true);
create policy "anon read shipping" on public.shipping_methods
  for select to anon using (active);
```

- [ ] **Step 2: Aplicar e verificar**

Run: aplicar no Supabase.
Expected: tabela criada; `select * from shipping_methods;` retorna 0 linhas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_formas_envio.sql
git commit -m "feat(db): tabela de formas de envio"
```

---

### Task 4: Migration de formas de pagamento

**Files:**
- Create: `supabase/migrations/0008_formas_pagamento.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0008_formas_pagamento.sql
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surcharge_percent numeric(5,2) not null default 0,
  surcharge_fixed numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_methods enable row level security;
create policy "admin all payment" on public.payment_methods
  for all to authenticated using (true) with check (true);
create policy "anon read payment" on public.payment_methods
  for select to anon using (active);
```

- [ ] **Step 2: Aplicar e verificar**

Run: aplicar no Supabase.
Expected: tabela criada; `select * from payment_methods;` retorna 0 linhas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_formas_pagamento.sql
git commit -m "feat(db): tabela de formas de pagamento"
```

---

### Task 5: Migration de colunas de envio/pagamento no pedido

**Files:**
- Create: `supabase/migrations/0009_pedido_envio_pagamento.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0009_pedido_envio_pagamento.sql
alter table public.orders
  add column items_subtotal numeric(10,2) not null default 0,
  add column shipping_label text not null default '',
  add column shipping_price numeric(10,2) not null default 0,
  add column payment_label text not null default '',
  add column payment_surcharge numeric(10,2) not null default 0;
```

- [ ] **Step 2: Aplicar e verificar**

Run: aplicar no Supabase.
Expected: colunas adicionadas em `orders`, sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_pedido_envio_pagamento.sql
git commit -m "feat(db): colunas de envio/pagamento no pedido"
```

---

## Phase 2 — Camada de dados + helpers (TDD)

### Task 6: Adicionar `weightGrams` ao tipo Product e ao mapper

**Files:**
- Modify: `lib/data/types.ts`
- Modify: `lib/data/mappers.ts`
- Modify: `lib/data/products.helpers.test.ts` (fixture)
- Modify: `lib/data/order.helpers.test.ts` (fixture)

- [ ] **Step 1: Adicionar campo ao tipo**

Em `lib/data/types.ts`, dentro de `interface Product`, adicione após `priceRetail`:

```ts
  priceRetail: number
  weightGrams: number
  countsForWholesale: boolean
```

- [ ] **Step 2: Ler no mapper**

Em `lib/data/mappers.ts`, dentro de `mapProductRow`, adicione após `priceRetail`:

```ts
    priceRetail: Number(r.price_retail ?? 0),
    weightGrams: Number(r.weight_grams ?? 0),
    countsForWholesale: r.counts_for_wholesale ?? true,
```

- [ ] **Step 3: Atualizar fixtures dos testes**

Em `lib/data/products.helpers.test.ts`, no objeto `p`, adicione `weightGrams: 250,` após `priceRetail: 89.9,`.

Em `lib/data/order.helpers.test.ts`, na função `prod`, adicione `weightGrams: 0,` no objeto base (após `priceRetail: 90,`).

- [ ] **Step 4: Rodar a suíte (deve continuar passando)**

Run: `pnpm test`
Expected: PASS (sem erros de tipo; testes existentes verdes).

- [ ] **Step 5: Commit**

```bash
git add lib/data/types.ts lib/data/mappers.ts lib/data/products.helpers.test.ts lib/data/order.helpers.test.ts
git commit -m "feat(data): peso (weightGrams) no Product e mapper"
```

---

### Task 7: Helper `shouldRenderAsButtons` (vitrine limpa)

**Files:**
- Modify: `lib/data/products.helpers.ts`
- Modify: `lib/data/products.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao final de `lib/data/products.helpers.test.ts`:

```ts
import { shouldRenderAsButtons } from './products.helpers'

describe('shouldRenderAsButtons', () => {
  it('false com nenhuma opção', () => {
    expect(shouldRenderAsButtons([])).toBe(false)
  })
  it('false com uma opção (mostra como texto)', () => {
    expect(shouldRenderAsButtons(['Preto'])).toBe(false)
  })
  it('true com duas ou mais opções', () => {
    expect(shouldRenderAsButtons(['P', 'M'])).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- products.helpers`
Expected: FAIL ("shouldRenderAsButtons is not a function" / export ausente).

- [ ] **Step 3: Implementar**

Adicione ao final de `lib/data/products.helpers.ts`:

```ts
/** true quando vale mostrar botões de seleção; false → mostrar como texto fixo. */
export function shouldRenderAsButtons(values: string[]): boolean {
  return values.length >= 2
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- products.helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/products.helpers.ts lib/data/products.helpers.test.ts
git commit -m "feat(data): helper shouldRenderAsButtons p/ vitrine limpa"
```

---

### Task 8: `buildOrder` com peso, frete e acréscimo

**Files:**
- Modify: `lib/data/order.helpers.ts`
- Modify: `lib/data/order.helpers.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicione em `lib/data/order.helpers.test.ts` (use a fixture `legging`, que terá `weightGrams`). Primeiro ajuste a fixture `legging` para incluir peso: na chamada `prod({...})` da `legging`, adicione `weightGrams: 250,`.

Depois adicione este bloco de describe:

```ts
describe('buildOrder — peso, frete e acréscimo', () => {
  it('soma o peso total (g) por quantidade', () => {
    const r = buildOrder([legging], [{ productId: 'L', size: 'M', color: 'Preto', quantity: 3 }], 4)
    expect(r.weightTotalGrams).toBe(750) // 250 * 3
    expect(r.items[0].weight_grams).toBe(250)
  })

  it('sem envio/pagamento: subtotal = total, acréscimo 0', () => {
    const r = buildOrder([legging], [{ productId: 'L', size: 'M', color: 'Preto', quantity: 2 }], 4)
    expect(r.itemsSubtotal).toBe(180)
    expect(r.shippingPrice).toBe(0)
    expect(r.paymentSurcharge).toBe(0)
    expect(r.total).toBe(180)
    expect(r.shippingLabel).toBe('A combinar')
    expect(r.paymentLabel).toBe('A combinar')
  })

  it('aplica frete e acréscimo (% sobre subtotal+frete) + fixo', () => {
    const r = buildOrder(
      [legging],
      [{ productId: 'L', size: 'M', color: 'Preto', quantity: 2 }], // subtotal 180
      4,
      { label: 'Correios', price: 20 },
      { label: 'Cartão', percent: 5, fixed: 2 },
    )
    // base = 180 + 20 = 200; acréscimo = 200*0.05 + 2 = 12
    expect(r.itemsSubtotal).toBe(180)
    expect(r.shippingPrice).toBe(20)
    expect(r.paymentSurcharge).toBe(12)
    expect(r.total).toBe(212) // 180 + 20 + 12
    expect(r.shippingLabel).toBe('Correios')
    expect(r.paymentLabel).toBe('Cartão')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- order.helpers`
Expected: FAIL (propriedades `weightTotalGrams`, `itemsSubtotal`, etc. não existem; assinatura com 5 args).

- [ ] **Step 3: Implementar `buildOrder`**

Substitua o conteúdo de `lib/data/order.helpers.ts` por:

```ts
// lib/data/order.helpers.ts
import { cartPriceType, unitPriceFor, cartTotal, type PriceType } from './cart.helpers'
import type { ProductWithVariants } from './types'

export interface RequestedItem {
  productId: string
  size: string
  color: string
  quantity: number
}

export interface ChosenShipping { label: string; price: number }
export interface ChosenPayment { label: string; percent: number; fixed: number }

export interface OrderItemRow {
  product_id: string
  variant_id: string | null
  product_code: string
  product_name: string
  size: string
  color: string
  quantity: number
  unit_price: number
  unit_cost: number
  weight_grams: number
}

export interface BuiltOrder {
  priceType: PriceType
  itemsSubtotal: number
  shippingLabel: string
  shippingPrice: number
  paymentLabel: string
  paymentSurcharge: number
  total: number
  weightTotalGrams: number
  items: OrderItemRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildOrder(
  products: ProductWithVariants[],
  requested: RequestedItem[],
  threshold: number,
  shipping?: ChosenShipping,
  payment?: ChosenPayment,
): BuiltOrder {
  const byId = new Map(products.map((p) => [p.id, p]))
  const cartItems = requested.map((r) => {
    const p = byId.get(r.productId)
    if (!p) throw new Error(`Produto não encontrado: ${r.productId}`)
    return { product: p, quantity: r.quantity, size: r.size, color: r.color }
  })

  const priceType = cartPriceType(cartItems, threshold)
  const itemsSubtotal = round2(cartTotal(cartItems, priceType))

  const items: OrderItemRow[] = cartItems.map((ci) => {
    const p = ci.product
    const variant = p.variants.find((v) => v.size === ci.size && v.color === ci.color)
    return {
      product_id: p.id,
      variant_id: variant?.id ?? null,
      product_code: p.code,
      product_name: p.name,
      size: ci.size,
      color: ci.color,
      quantity: ci.quantity,
      unit_price: unitPriceFor(p, priceType),
      unit_cost: p.priceCost,
      weight_grams: p.weightGrams,
    }
  })

  const weightTotalGrams = items.reduce((acc, it) => acc + it.weight_grams * it.quantity, 0)

  const shippingLabel = shipping?.label ?? 'A combinar'
  const shippingPrice = round2(shipping?.price ?? 0)

  const base = itemsSubtotal + shippingPrice
  const paymentLabel = payment?.label ?? 'A combinar'
  const paymentSurcharge = payment
    ? round2(base * (payment.percent / 100) + payment.fixed)
    : 0

  const total = round2(itemsSubtotal + shippingPrice + paymentSurcharge)

  return {
    priceType,
    itemsSubtotal,
    shippingLabel,
    shippingPrice,
    paymentLabel,
    paymentSurcharge,
    total,
    weightTotalGrams,
    items,
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- order.helpers`
Expected: PASS (incluindo os testes antigos: `r.total` de 180 e 216 continuam corretos).

- [ ] **Step 5: Commit**

```bash
git add lib/data/order.helpers.ts lib/data/order.helpers.test.ts
git commit -m "feat(data): buildOrder com peso, frete e acréscimo de pagamento"
```

---

### Task 9: Tipos e mapper do pedido (campos novos)

**Files:**
- Modify: `lib/data/orders.types.ts`
- Modify: `lib/data/orders.ts`

- [ ] **Step 1: Adicionar campos aos tipos**

Em `lib/data/orders.types.ts`, em `interface OrderItem`, adicione após `unitCost`:

```ts
  unitCost: number
  weightGrams: number
```

Em `interface OrderWithItems`, adicione após `total: number`:

```ts
  total: number
  itemsSubtotal: number
  shippingLabel: string
  shippingPrice: number
  paymentLabel: string
  paymentSurcharge: number
  weightTotalGrams: number
```

- [ ] **Step 2: Mapear os campos**

Em `lib/data/orders.ts`, em `mapItem`, adicione após `unitCost`:

```ts
    unitCost: Number(r.unit_cost ?? 0),
    weightGrams: Number(r.weight_grams ?? 0),
```

Em `mapOrder`, troque o final (a partir de `total:`) por:

```ts
    total: Number(r.total ?? 0),
    itemsSubtotal: Number(r.items_subtotal ?? 0),
    shippingLabel: r.shipping_label ?? '',
    shippingPrice: Number(r.shipping_price ?? 0),
    paymentLabel: r.payment_label ?? '',
    paymentSurcharge: Number(r.payment_surcharge ?? 0),
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    items: (r.order_items ?? []).map(mapItem),
  }
```

E logo após montar `items`, calcule o peso total. Reescreva `mapOrder` para computar `weightTotalGrams`:

```ts
function mapOrder(r: any): OrderWithItems {
  const items: OrderItem[] = (r.order_items ?? []).map(mapItem)
  const weightTotalGrams = items.reduce((acc, it) => acc + it.weightGrams * it.quantity, 0)
  return {
    id: r.id,
    number: Number(r.number),
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    status: r.status,
    priceType: r.price_type,
    total: Number(r.total ?? 0),
    itemsSubtotal: Number(r.items_subtotal ?? 0),
    shippingLabel: r.shipping_label ?? '',
    shippingPrice: Number(r.shipping_price ?? 0),
    paymentLabel: r.payment_label ?? '',
    paymentSurcharge: Number(r.payment_surcharge ?? 0),
    weightTotalGrams,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    items,
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm test` (compila tudo) — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/data/orders.types.ts lib/data/orders.ts
git commit -m "feat(data): pedido expõe peso total, frete e acréscimo"
```

---

### Task 10: Módulos de leitura `categories.ts`, `shipping.ts`, `payment.ts`

**Files:**
- Create: `lib/data/categories.ts`
- Create: `lib/data/shipping.ts`
- Create: `lib/data/payment.ts`

- [ ] **Step 1: Criar `categories.ts`**

```ts
// lib/data/categories.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface Category {
  id: string
  name: string
  sortOrder: number
}

function map(r: any): Category {
  return { id: r.id, name: r.name, sortOrder: Number(r.sort_order ?? 0) }
}

export async function getCategories(): Promise<Category[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(map)
}
```

- [ ] **Step 2: Criar `shipping.ts`**

```ts
// lib/data/shipping.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface ShippingMethod {
  id: string
  name: string
  price: number
  active: boolean
  sortOrder: number
}

function map(r: any): ShippingMethod {
  return {
    id: r.id, name: r.name, price: Number(r.price ?? 0),
    active: r.active ?? true, sortOrder: Number(r.sort_order ?? 0),
  }
}

export async function getShippingMethods(activeOnly = false): Promise<ShippingMethod[]> {
  const db = createAdminClient()
  let q = db.from('shipping_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(map)
}
```

- [ ] **Step 3: Criar `payment.ts`**

```ts
// lib/data/payment.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface PaymentMethod {
  id: string
  name: string
  surchargePercent: number
  surchargeFixed: number
  active: boolean
  sortOrder: number
}

function map(r: any): PaymentMethod {
  return {
    id: r.id, name: r.name,
    surchargePercent: Number(r.surcharge_percent ?? 0),
    surchargeFixed: Number(r.surcharge_fixed ?? 0),
    active: r.active ?? true, sortOrder: Number(r.sort_order ?? 0),
  }
}

export async function getPaymentMethods(activeOnly = false): Promise<PaymentMethod[]> {
  const db = createAdminClient()
  let q = db.from('payment_methods').select('*').order('sort_order', { ascending: true })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(map)
}
```

- [ ] **Step 4: Verificar compilação**

Run: `pnpm test` — Expected: PASS (sem erro de tipos).

- [ ] **Step 5: Commit**

```bash
git add lib/data/categories.ts lib/data/shipping.ts lib/data/payment.ts
git commit -m "feat(data): leitura de categorias, formas de envio e pagamento"
```

---

## Phase 3 — Vitrine limpa (público)

### Task 11: Product card mostra texto quando há 1 opção

**Files:**
- Modify: `components/product-card.tsx`

- [ ] **Step 1: Importar o helper**

Em `components/product-card.tsx`, troque a linha de import dos helpers por:

```ts
import { sizesOf, colorsOf, isVariantAvailable, shouldRenderAsButtons } from '@/lib/data/products.helpers'
```

- [ ] **Step 2: Bloco de Tamanho condicional**

Substitua o bloco `{/* Tamanho */}` inteiro por:

```tsx
        {/* Tamanho */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">Tamanho</span>
          {shouldRenderAsButtons(sizes) ? (
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-lg text-xs md:text-sm font-medium transition-all ${
                    selectedSize === size ? 'bg-[#CFFF04] text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-sm md:text-base font-medium text-foreground">{sizes[0] ?? '—'}</span>
          )}
        </div>
```

- [ ] **Step 3: Bloco de Cor condicional**

Substitua o bloco `{/* Cor */}` inteiro por:

```tsx
        {/* Cor */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">
            Cor{!shouldRenderAsButtons(colors) ? `: ${colors[0] ?? '—'}` : `: ${selectedColor}`}
          </span>
          {shouldRenderAsButtons(colors) && (
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
              {colors.map((color) => {
                const colorOk = isVariantAvailable(product, selectedSize, color)
                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    disabled={!colorOk}
                    className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all ${
                      selectedColor === color ? 'bg-[#CFFF04] text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    } ${!colorOk ? 'opacity-40 line-through cursor-not-allowed' : ''}`}
                  >
                    {color}
                  </button>
                )
              })}
            </div>
          )}
        </div>
```

- [ ] **Step 4: Verificar build**

Run: `pnpm build` (ou `pnpm dev` e abrir a home)
Expected: compila; produto com 1 cor mostra "Cor: Preto" sem botão; com 2+ mostra botões.

- [ ] **Step 5: Commit**

```bash
git add components/product-card.tsx
git commit -m "feat(vitrine): mostra cor/tamanho como texto quando há 1 opção"
```

---

## Phase 4 — Admin: categorias

### Task 12: Schema e actions de categorias

**Files:**
- Create: `app/painel/categorias/actions.ts`

- [ ] **Step 1: Criar as actions**

```ts
// app/painel/categorias/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
}

export async function createCategoria(name: string) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('categories').insert({ name: nome })
  if (error) throw new Error('Não foi possível criar (nome duplicado?).')
  revalidatePath('/painel/categorias')
  revalidatePath('/')
}

export async function renameCategoria(id: string, oldName: string, newName: string) {
  await requireUser()
  const nome = newName.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('categories').update({ name: nome, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error('Não foi possível renomear (nome duplicado?).')
  // propaga o novo nome para os produtos que usavam o nome antigo
  await db.from('products').update({ category: nome, updated_at: new Date().toISOString() }).eq('category', oldName)
  revalidatePath('/painel/categorias')
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function deleteCategoria(id: string, name: string) {
  await requireUser()
  const db = createAdminClient()
  const { count, error: cErr } = await db
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category', name)
  if (cErr) throw cErr
  if ((count ?? 0) > 0) {
    throw new Error(`${count} produto(s) usam "${name}". Mova-os antes de apagar.`)
  }
  const { error } = await db.from('categories').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/painel/categorias')
  revalidatePath('/')
}
```

- [ ] **Step 2: Verificar compilação**

Run: `pnpm test` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/painel/categorias/actions.ts
git commit -m "feat(admin): actions de categorias (criar/renomear/apagar bloqueado)"
```

---

### Task 13: UI de gerência de categorias

**Files:**
- Create: `app/painel/categorias/_components/categorias-manager.tsx`
- Create: `app/painel/categorias/page.tsx`

- [ ] **Step 1: Criar o componente cliente**

```tsx
// app/painel/categorias/_components/categorias-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategoria, renameCategoria, deleteCategoria } from '../actions'
import type { Category } from '@/lib/data/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Pencil, Plus, Check, X } from 'lucide-react'

export function CategoriasManager({ categorias }: { categorias: Category[] }) {
  const router = useRouter()
  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setErro(null); setBusy(true)
    try { await fn(); router.refresh() }
    catch (e: any) { setErro(e?.message ?? 'Erro') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); run(async () => { await createCategoria(novo); setNovo('') }) }}
        className="flex gap-2"
      >
        <Input placeholder="Nova categoria" value={novo} onChange={(e) => setNovo(e.target.value)} className="h-11" />
        <Button type="submit" disabled={busy || !novo.trim()} className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {categorias.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma categoria ainda. Crie a primeira acima.</p>
      ) : (
        <ul className="space-y-2">
          {categorias.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
              {editId === c.id ? (
                <>
                  <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-10" />
                  <Button size="icon" variant="ghost" disabled={busy}
                    onClick={() => run(async () => { await renameCategoria(c.id, c.name, editValue); setEditId(null) })}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setEditValue(c.name); setErro(null) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={busy}
                    onClick={() => run(async () => { await deleteCategoria(c.id, c.name) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar a página (server component)**

```tsx
// app/painel/categorias/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCategories } from '@/lib/data/categories'
import { CategoriasManager } from './_components/categorias-manager'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const categorias = await getCategories()

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-xl space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Categorias</h1>
        <p className="text-sm text-muted-foreground">Crie, renomeie ou apague. Não dá pra apagar categoria em uso.</p>
      </div>
      <CategoriasManager categorias={categorias} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build`
Expected: compila; rota `/painel/categorias` existe.

- [ ] **Step 4: Commit**

```bash
git add app/painel/categorias/
git commit -m "feat(admin): tela de gerência de categorias"
```

---

## Phase 5 — Admin: formas de envio

### Task 14: Actions de formas de envio

**Files:**
- Create: `app/painel/envio/actions.ts`

- [ ] **Step 1: Criar as actions**

```ts
// app/painel/envio/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
}

export async function createShipping(name: string, price: number) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods').insert({ name: nome, price: Math.max(0, price || 0) })
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}

export async function updateShipping(id: string, name: string, price: number, active: boolean) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods')
    .update({ name: nome, price: Math.max(0, price || 0), active, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}

export async function deleteShipping(id: string) {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.from('shipping_methods').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/painel/envio'); revalidatePath('/')
}
```

- [ ] **Step 2: Verificar compilação**

Run: `pnpm test` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/painel/envio/actions.ts
git commit -m "feat(admin): actions de formas de envio"
```

---

### Task 15: UI de formas de envio

**Files:**
- Create: `app/painel/envio/_components/envio-manager.tsx`
- Create: `app/painel/envio/page.tsx`

- [ ] **Step 1: Criar o componente cliente**

```tsx
// app/painel/envio/_components/envio-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createShipping, updateShipping, deleteShipping } from '../actions'
import type { ShippingMethod } from '@/lib/data/shipping'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus } from 'lucide-react'

export function EnvioManager({ metodos }: { metodos: ShippingMethod[] }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('0')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setErro(null); setBusy(true)
    try { await fn(); router.refresh() }
    catch (e: any) { setErro(e?.message ?? 'Erro') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); run(async () => { await createShipping(nome, Number(preco)); setNome(''); setPreco('0') }) }}
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end"
      >
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input placeholder="Ex: Correios" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Frete (R$)</Label>
          <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className="h-11 w-28" />
        </div>
        <Button type="submit" disabled={busy || !nome.trim()} className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {metodos.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma forma de envio ainda.</p>
      ) : (
        <ul className="space-y-2">
          {metodos.map((m) => (
            <EnvioRow key={m.id} m={m} busy={busy} run={run} />
          ))}
        </ul>
      )}
    </div>
  )
}

function EnvioRow({ m, busy, run }: { m: ShippingMethod; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const [nome, setNome] = useState(m.name)
  const [preco, setPreco] = useState(String(m.price))
  const [active, setActive] = useState(m.active)
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-10 flex-1 min-w-[140px]" />
      <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className="h-10 w-24" />
      <div className="flex items-center gap-1">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">Ativo</span>
      </div>
      <Button size="sm" disabled={busy}
        onClick={() => run(async () => { await updateShipping(m.id, nome, Number(preco), active) })}>
        Salvar
      </Button>
      <Button size="icon" variant="ghost" disabled={busy}
        onClick={() => run(async () => { await deleteShipping(m.id) })}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </li>
  )
}
```

- [ ] **Step 2: Criar a página**

```tsx
// app/painel/envio/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getShippingMethods } from '@/lib/data/shipping'
import { EnvioManager } from './_components/envio-manager'

export default async function EnvioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const metodos = await getShippingMethods()

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Formas de envio</h1>
        <p className="text-sm text-muted-foreground">O cliente escolhe no carrinho; o frete entra no total.</p>
      </div>
      <EnvioManager metodos={metodos} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build` — Expected: compila; rota `/painel/envio` existe.

- [ ] **Step 4: Commit**

```bash
git add app/painel/envio/
git commit -m "feat(admin): tela de formas de envio"
```

---

## Phase 6 — Admin: formas de pagamento

### Task 16: Actions de formas de pagamento

**Files:**
- Create: `app/painel/pagamento/actions.ts`

- [ ] **Step 1: Criar as actions**

```ts
// app/painel/pagamento/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
}

export async function createPayment(name: string, percent: number, fixed: number) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').insert({
    name: nome,
    surcharge_percent: Math.max(0, percent || 0),
    surcharge_fixed: Math.max(0, fixed || 0),
  })
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}

export async function updatePayment(id: string, name: string, percent: number, fixed: number, active: boolean) {
  await requireUser()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').update({
    name: nome,
    surcharge_percent: Math.max(0, percent || 0),
    surcharge_fixed: Math.max(0, fixed || 0),
    active,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}

export async function deletePayment(id: string) {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.from('payment_methods').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/painel/pagamento'); revalidatePath('/')
}
```

- [ ] **Step 2: Verificar compilação**

Run: `pnpm test` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/painel/pagamento/actions.ts
git commit -m "feat(admin): actions de formas de pagamento"
```

---

### Task 17: UI de formas de pagamento

**Files:**
- Create: `app/painel/pagamento/_components/pagamento-manager.tsx`
- Create: `app/painel/pagamento/page.tsx`

- [ ] **Step 1: Criar o componente cliente**

```tsx
// app/painel/pagamento/_components/pagamento-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPayment, updatePayment, deletePayment } from '../actions'
import type { PaymentMethod } from '@/lib/data/payment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus } from 'lucide-react'

export function PagamentoManager({ metodos }: { metodos: PaymentMethod[] }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [percent, setPercent] = useState('0')
  const [fixed, setFixed] = useState('0')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setErro(null); setBusy(true)
    try { await fn(); router.refresh() }
    catch (e: any) { setErro(e?.message ?? 'Erro') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); run(async () => { await createPayment(nome, Number(percent), Number(fixed)); setNome(''); setPercent('0'); setFixed('0') }) }}
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
      >
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input placeholder="Ex: Cartão 3x" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Acréscimo %</Label>
          <Input type="number" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="h-11 w-24" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">+ R$ fixo</Label>
          <Input type="number" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} className="h-11 w-24" />
        </div>
        <Button type="submit" disabled={busy || !nome.trim()} className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {metodos.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma forma de pagamento ainda.</p>
      ) : (
        <ul className="space-y-2">
          {metodos.map((m) => (
            <PagamentoRow key={m.id} m={m} busy={busy} run={run} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PagamentoRow({ m, busy, run }: { m: PaymentMethod; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const [nome, setNome] = useState(m.name)
  const [percent, setPercent] = useState(String(m.surchargePercent))
  const [fixed, setFixed] = useState(String(m.surchargeFixed))
  const [active, setActive] = useState(m.active)
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-10 flex-1 min-w-[140px]" />
      <Input type="number" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="h-10 w-20" title="Acréscimo %" />
      <Input type="number" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} className="h-10 w-20" title="+ R$ fixo" />
      <div className="flex items-center gap-1">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">Ativo</span>
      </div>
      <Button size="sm" disabled={busy}
        onClick={() => run(async () => { await updatePayment(m.id, nome, Number(percent), Number(fixed), active) })}>
        Salvar
      </Button>
      <Button size="icon" variant="ghost" disabled={busy}
        onClick={() => run(async () => { await deletePayment(m.id) })}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </li>
  )
}
```

- [ ] **Step 2: Criar a página**

```tsx
// app/painel/pagamento/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPaymentMethods } from '@/lib/data/payment'
import { PagamentoManager } from './_components/pagamento-manager'

export default async function PagamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const metodos = await getPaymentMethods()

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Formas de pagamento</h1>
        <p className="text-sm text-muted-foreground">Acréscimo opcional (% sobre subtotal+frete e/ou valor fixo).</p>
      </div>
      <PagamentoManager metodos={metodos} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build` — Expected: compila; rota `/painel/pagamento` existe.

- [ ] **Step 4: Commit**

```bash
git add app/painel/pagamento/
git commit -m "feat(admin): tela de formas de pagamento"
```

---

### Task 18: Links no painel principal

**Files:**
- Modify: `app/painel/page.tsx`

- [ ] **Step 1: Adicionar os links**

Em `app/painel/page.tsx`, no `div` com a classe `flex gap-3 flex-wrap`, substitua o conteúdo pelos links abaixo (mantém Produtos/Pedidos/Financeiro e adiciona os novos):

```tsx
      <div className="flex gap-3 flex-wrap">
        <Link href="/painel/produtos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Produtos</Link>
        <Link href="/painel/categorias" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Categorias</Link>
        <Link href="/painel/envio" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Envio</Link>
        <Link href="/painel/pagamento" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pagamento</Link>
        <Link href="/painel/pedidos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pedidos</Link>
        <Link href="/painel/financeiro" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Financeiro</Link>
      </div>
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build` — Expected: compila; links aparecem.

- [ ] **Step 3: Commit**

```bash
git add app/painel/page.tsx
git commit -m "feat(admin): links de categorias, envio e pagamento no painel"
```

---

## Phase 7 — Produto: peso, categoria dropdown, label, lista responsiva

### Task 19: Schema e action do produto com peso

**Files:**
- Modify: `app/painel/produtos/_components/produto-schema.ts`
- Modify: `app/painel/produtos/actions.ts`

- [ ] **Step 1: Adicionar weightGrams ao schema**

Em `app/painel/produtos/_components/produto-schema.ts`, dentro de `produtoSchema`, adicione após `priceRetail`:

```ts
  priceRetail: z.number().min(0),
  weightGrams: z.number().int().min(0).default(0),
```

- [ ] **Step 2: Gravar weight_grams nas actions**

Em `app/painel/produtos/actions.ts`, na função `createProduto`, no `.insert({...})` de `products`, adicione `weight_grams: data.weightGrams,` logo após `price_retail: data.priceRetail,`.

Na função `updateProduto`, no `.update({...})` de `products`, adicione `weight_grams: data.weightGrams,` logo após `price_retail: data.priceRetail,`.

- [ ] **Step 3: Verificar compilação**

Run: `pnpm test` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/painel/produtos/_components/produto-schema.ts app/painel/produtos/actions.ts
git commit -m "feat(admin): produto grava peso (gramas)"
```

---

### Task 20: Form do produto — peso, dropdown de categoria, label "Número/Código"

**Files:**
- Modify: `app/painel/produtos/_components/produto-form.tsx`
- Modify: `app/painel/produtos/novo/page.tsx`
- Modify: `app/painel/produtos/[id]/page.tsx`

- [ ] **Step 1: Form aceita lista de categorias e novos campos**

Em `app/painel/produtos/_components/produto-form.tsx`:

(a) Troque a assinatura do componente para receber `categorias`:

```tsx
export function ProdutoForm({ mode, produto, categorias }: { mode: 'create' | 'edit'; produto?: ProductWithVariants; categorias: string[] }) {
```

(b) Em `defaultValues`, no ramo de edição adicione `weightGrams: produto.weightGrams,` (após `priceRetail`), e no ramo de criação adicione `weightGrams: 0,` (após `priceRetail: 0,`).

(c) Troque o label do campo Código de `Código` para `Número/Código`:

```tsx
          <Label htmlFor="code">Número/Código</Label>
```

(d) Substitua o bloco da categoria (o `div` com `Label htmlFor="category"` e o `Input`) por um select:

```tsx
      <div className="space-y-1">
        <Label htmlFor="category">Categoria</Label>
        <select
          id="category"
          {...register('category')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
```

(e) Adicione o campo de peso. No `grid grid-cols-3 gap-4` dos preços, troque por `grid grid-cols-2 md:grid-cols-4 gap-4` e adicione um quarto campo após o de Varejo:

```tsx
        <div className="space-y-1">
          <Label htmlFor="weightGrams">Peso (g)</Label>
          <Input id="weightGrams" type="number" step="1" {...register('weightGrams', { valueAsNumber: true })} />
        </div>
```

(f) Deixe o container do form mais confortável no mobile: troque `className="container mx-auto p-6 max-w-2xl space-y-5"` por `className="container mx-auto p-4 md:p-6 max-w-2xl space-y-5"`.

- [ ] **Step 2: Página "novo" passa categorias**

Substitua `app/painel/produtos/novo/page.tsx` por:

```tsx
// app/painel/produtos/novo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCategories } from '@/lib/data/categories'
import { ProdutoForm } from '../_components/produto-form'

export default async function NovoProdutoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const categorias = (await getCategories()).map((c) => c.name)
  return <ProdutoForm mode="create" categorias={categorias} />
}
```

> Se o arquivo atual tiver detalhes diferentes (ex: já busca outras coisas), preserve o que existir e apenas adicione o fetch de categorias e a prop. O essencial: passar `categorias` (string[]) para o `ProdutoForm`.

- [ ] **Step 3: Página "editar" passa categorias**

Em `app/painel/produtos/[id]/page.tsx`, importe `getCategories` e passe a prop. Adicione o import:

```tsx
import { getCategories } from '@/lib/data/categories'
```

Antes do `return` que renderiza `<ProdutoForm ... />`, carregue as categorias:

```tsx
  const categorias = (await getCategories()).map((c) => c.name)
```

E no JSX, adicione a prop no componente:

```tsx
  return <ProdutoForm mode="edit" produto={produto} categorias={categorias} />
```

> Garanta que a categoria atual do produto apareça mesmo que tenha sido removida da lista: no Step 1(d), antes de `categorias.map`, você pode incluir o valor atual. Para manter simples, se `produto.category` não estiver na lista, o `register` ainda mantém o valor salvo no envio; o select mostrará "Sem categoria" visualmente. Aceitável neste momento (a loja recadastra categorias antes dos produtos).

- [ ] **Step 4: Verificar build**

Run: `pnpm build`
Expected: compila; form mostra "Número/Código", dropdown de categoria e campo "Peso (g)".

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/_components/produto-form.tsx app/painel/produtos/novo/page.tsx "app/painel/produtos/[id]/page.tsx"
git commit -m "feat(admin): produto com peso, categoria via dropdown e label Número/Código"
```

---

### Task 21: Lista de produtos responsiva (cards no mobile)

**Files:**
- Modify: `app/painel/produtos/page.tsx`

- [ ] **Step 1: Esconder a tabela no mobile e adicionar cards**

Em `app/painel/produtos/page.tsx`, na `div` que envolve a `<table>` (a com `overflow-x-auto rounded-xl border border-border`), adicione a classe `hidden md:block` para esconder no celular:

```tsx
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
```

Logo após o fechamento dessa `div` da tabela (antes do fechamento do bloco condicional `)}`), adicione a lista de cards para mobile:

```tsx
        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {produtos.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3 flex gap-3">
              <img src={p.imageUrl ?? '/placeholder.svg'} alt={p.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.category || 'Sem categoria'}</p>
                <div className="text-sm mt-1">Varejo: {fmt(p.priceRetail)} · Atacado: {fmt(p.priceWholesale)}</div>
                <div className="text-xs text-muted-foreground">
                  Estoque: {p.variants.reduce((a, v) => a + v.stock, 0)} · {p.active ? 'Ativo' : 'Inativo'}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Link href={`/painel/produtos/${p.id}`} className="text-[#9bbf00] hover:underline">Editar</Link>
                  <ProdutoActions id={p.id} active={p.active} />
                </div>
              </div>
            </div>
          ))}
        </div>
```

> `fmt`, `Link`, `ProdutoActions` já estão importados/definidos nesse arquivo.

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Expected: compila; em tela estreita aparecem cards, em tela larga a tabela.

- [ ] **Step 3: Commit**

```bash
git add app/painel/produtos/page.tsx
git commit -m "feat(admin): lista de produtos responsiva (cards no celular)"
```

---

## Phase 8 — Checkout: envio/pagamento, total e mensagem detalhada

### Task 22: `criarPedido` resolve envio/pagamento do banco

**Files:**
- Modify: `app/_actions/criar-pedido.ts`

- [ ] **Step 1: Aceitar IDs e recalcular no servidor**

Substitua `app/_actions/criar-pedido.ts` por:

```ts
// app/_actions/criar-pedido.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStoreSettings } from '@/lib/data/settings'
import { mapProductRow, mapVariantRow } from '@/lib/data/mappers'
import { buildOrder, type RequestedItem, type ChosenShipping, type ChosenPayment } from '@/lib/data/order.helpers'
import type { ProductWithVariants } from '@/lib/data/types'

export interface CriarPedidoInput {
  customerName: string
  customerPhone: string
  items: RequestedItem[]
  shippingMethodId?: string | null
  paymentMethodId?: string | null
}

export interface CriarPedidoResult {
  number: number
  total: number
  priceType: 'retail' | 'wholesale'
}

export async function criarPedido(input: CriarPedidoInput): Promise<CriarPedidoResult> {
  if (!input.items?.length) throw new Error('Carrinho vazio')

  const db = createAdminClient()
  const ids = [...new Set(input.items.map((i) => i.productId))]

  const { data: prows, error } = await db.from('products').select('*').in('id', ids)
  if (error) throw error
  const { data: vrows, error: vErr } = await db.from('product_variants').select('*').in('product_id', ids)
  if (vErr) throw vErr

  const products: ProductWithVariants[] = (prows ?? []).map((p) => ({
    ...mapProductRow(p),
    variants: (vrows ?? []).filter((v) => v.product_id === p.id).map(mapVariantRow),
  }))

  // resolve envio/pagamento a partir do banco (não confia em valores do cliente)
  let shipping: ChosenShipping | undefined
  if (input.shippingMethodId) {
    const { data: s } = await db.from('shipping_methods').select('name, price').eq('id', input.shippingMethodId).single()
    if (s) shipping = { label: s.name, price: Number(s.price ?? 0) }
  }
  let payment: ChosenPayment | undefined
  if (input.paymentMethodId) {
    const { data: pm } = await db.from('payment_methods').select('name, surcharge_percent, surcharge_fixed').eq('id', input.paymentMethodId).single()
    if (pm) payment = { label: pm.name, percent: Number(pm.surcharge_percent ?? 0), fixed: Number(pm.surcharge_fixed ?? 0) }
  }

  const settings = await getStoreSettings()
  const built = buildOrder(products, input.items, settings.wholesaleThreshold, shipping, payment)

  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      status: 'pending',
      price_type: built.priceType,
      items_subtotal: built.itemsSubtotal,
      shipping_label: built.shippingLabel,
      shipping_price: built.shippingPrice,
      payment_label: built.paymentLabel,
      payment_surcharge: built.paymentSurcharge,
      total: built.total,
    })
    .select('id, number')
    .single()
  if (oErr) throw oErr

  const itemRows = built.items.map((it) => ({ ...it, order_id: order.id }))
  const { error: iErr } = await db.from('order_items').insert(itemRows)
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw iErr
  }

  return { number: order.number as number, total: built.total, priceType: built.priceType }
}
```

- [ ] **Step 2: Verificar compilação**

Run: `pnpm test` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/_actions/criar-pedido.ts
git commit -m "feat(pedido): resolve envio/pagamento no servidor e grava total final"
```

---

### Task 23: Home carrega métodos ativos e repassa ao carrinho

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/_components/catalog.tsx`

- [ ] **Step 1: Carregar métodos ativos na home**

Em `app/page.tsx`, importe os módulos e passe ao `Catalog`. Adicione os imports:

```tsx
import { getShippingMethods } from '@/lib/data/shipping'
import { getPaymentMethods } from '@/lib/data/payment'
```

No corpo do componente, antes do `return`, carregue:

```tsx
  const shippingMethods = await getShippingMethods(true)
  const paymentMethods = await getPaymentMethods(true)
```

E passe as props para `<Catalog ... />`:

```tsx
  shippingMethods={shippingMethods}
  paymentMethods={paymentMethods}
```

> Mantenha as props existentes (`products`, `threshold`, `whatsappNumber`). Apenas acrescente as duas novas.

- [ ] **Step 2: Catalog repassa ao Cart**

Em `app/_components/catalog.tsx`:

(a) Importe os tipos:

```tsx
import type { ShippingMethod } from '@/lib/data/shipping'
import type { PaymentMethod } from '@/lib/data/payment'
```

(b) Amplie a assinatura:

```tsx
export function Catalog({ products, threshold, whatsappNumber, shippingMethods, paymentMethods }: { products: ProductWithVariants[]; threshold: number; whatsappNumber: string; shippingMethods: ShippingMethod[]; paymentMethods: PaymentMethod[] }) {
```

(c) Passe ao `<Cart />` (no fim do componente):

```tsx
      <Cart threshold={threshold} whatsappNumber={whatsappNumber} shippingMethods={shippingMethods} paymentMethods={paymentMethods} />
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build` — Expected: compila (o Cart ainda não usa as props; será no próximo task). Se o TS reclamar de props faltando no Cart, siga direto para o Task 24 e rode o build depois.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/_components/catalog.tsx
git commit -m "feat(checkout): home repassa formas de envio/pagamento ao carrinho"
```

---

### Task 24: Carrinho — seletores, total e mensagem detalhada

**Files:**
- Modify: `components/cart.tsx`

- [ ] **Step 1: Ampliar props e estado**

Em `components/cart.tsx`:

(a) Importe os tipos e helper de round:

```tsx
import type { ShippingMethod } from '@/lib/data/shipping'
import type { PaymentMethod } from '@/lib/data/payment'
```

(b) Amplie a assinatura e props:

```tsx
export function Cart({ threshold, whatsappNumber, shippingMethods, paymentMethods }: { threshold: number; whatsappNumber: string; shippingMethods: ShippingMethod[]; paymentMethods: PaymentMethod[] }) {
```

(c) Adicione estados (junto dos outros `useState`):

```tsx
  const [shippingId, setShippingId] = useState<string>('')
  const [paymentId, setPaymentId] = useState<string>('')
```

(d) Logo após `const total = cartTotal(items, priceType)`, calcule frete/acréscimo/total final:

```tsx
  const round2 = (n: number) => Math.round(n * 100) / 100
  const selShipping = shippingMethods.find((m) => m.id === shippingId)
  const selPayment = paymentMethods.find((m) => m.id === paymentId)
  const subtotal = total
  const frete = selShipping?.price ?? 0
  const acrescimo = selPayment ? round2((subtotal + frete) * (selPayment.surchargePercent / 100) + selPayment.surchargeFixed) : 0
  const totalFinal = round2(subtotal + frete + acrescimo)
  const pesoTotalG = items.reduce((acc, i) => acc + i.product.weightGrams * i.quantity, 0)
```

- [ ] **Step 2: Mensagem do WhatsApp detalhada**

Substitua a função `generateOrderText` por:

```tsx
  const generateOrderText = () => {
    const date = new Date().toLocaleDateString('pt-BR')
    const fmtKg = (g: number) => `${(g / 1000).toFixed(3).replace('.', ',')} kg`
    let text = `Data: ${date}\n\n`
    text += `*Cliente:* ${customerName}\n`
    text += `*Telefone:* ${customerPhone}\n\n`
    text += `*Tipo de preço:* ${priceType === 'wholesale' ? 'ATACADO' : 'VAREJO'}\n\n`
    text += `*ITENS DO PEDIDO:*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`
    items.forEach((item, index) => {
      const price = unitPriceFor(item.product, priceType)
      text += `${index + 1}. *${item.product.name}* (${item.product.code})\n`
      text += `   Tamanho: ${item.size}\n`
      text += `   Cor: ${item.color}\n`
      text += `   Qtd: ${item.quantity} x ${formatPrice(price)}\n`
      text += `   Subtotal: *${formatPrice(price * item.quantity)}*\n\n`
    })
    text += `━━━━━━━━━━━━━━━━━━\n`
    text += `*Subtotal:* ${formatPrice(subtotal)}\n`
    text += `*Peso total:* ${fmtKg(pesoTotalG)}\n`
    text += `*Envio:* ${selShipping ? `${selShipping.name} (${formatPrice(frete)})` : 'A combinar'}\n`
    text += `*Pagamento:* ${selPayment ? selPayment.name : 'A combinar'}${acrescimo > 0 ? ` (+${formatPrice(acrescimo)})` : ''}\n`
    text += `*TOTAL GERAL: ${formatPrice(totalFinal)}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`
    text += `_Pedido enviado pelo Menu Digital KAROLLA FIT_`
    return text
  }
```

- [ ] **Step 3: Enviar IDs ao criar o pedido**

Na função `handleSendOrder`, na chamada `criarPedido({...})`, adicione os IDs:

```tsx
      const r = await criarPedido({
        customerName,
        customerPhone,
        items: items.map((i) => ({ productId: i.product.id, size: i.size, color: i.color, quantity: i.quantity })),
        shippingMethodId: shippingId || null,
        paymentMethodId: paymentId || null,
      })
```

E no `setTimeout` de limpeza, resete os seletores adicionando:

```tsx
      setShippingId('')
      setPaymentId('')
```

- [ ] **Step 4: Seletores no checkout**

No bloco de checkout (`key="checkout"`), logo após o `div` que contém os campos Nome e Telefone (o `div` com `space-y-3 md:space-y-4` que fecha após o campo de telefone), adicione:

```tsx
                        <div className="space-y-3 md:space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs md:text-sm">Forma de envio</Label>
                            <select
                              value={shippingId}
                              onChange={(e) => setShippingId(e.target.value)}
                              className="w-full h-10 md:h-12 rounded-md border border-border bg-muted px-3 text-sm md:text-base"
                            >
                              <option value="">A combinar</option>
                              {shippingMethods.map((m) => (
                                <option key={m.id} value={m.id}>{m.name} — {formatPrice(m.price)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs md:text-sm">Forma de pagamento</Label>
                            <select
                              value={paymentId}
                              onChange={(e) => setPaymentId(e.target.value)}
                              className="w-full h-10 md:h-12 rounded-md border border-border bg-muted px-3 text-sm md:text-base"
                            >
                              <option value="">A combinar</option>
                              {paymentMethods.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}{(m.surchargePercent > 0 || m.surchargeFixed > 0) ? ' (+acréscimo)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
```

- [ ] **Step 5: Resumo com subtotal/frete/acréscimo/total**

No bloco "Resumo do Pedido", substitua a linha do total (o `div` com `border-t ... flex justify-between font-semibold`) por estas linhas:

```tsx
                          <div className="border-t border-border pt-2 md:pt-3 space-y-1 text-xs md:text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Frete</span><span>{selShipping ? formatPrice(frete) : 'A combinar'}</span>
                            </div>
                            {acrescimo > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Acréscimo</span><span>{formatPrice(acrescimo)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold text-sm md:text-base pt-1">
                              <span>Total</span><span className="text-[#CFFF04]">{formatPrice(totalFinal)}</span>
                            </div>
                          </div>
```

- [ ] **Step 6: Verificar build e fluxo**

Run: `pnpm build`
Expected: compila. No `pnpm dev`: ao escolher envio/pagamento, Subtotal/Frete/Acréscimo/Total atualizam; mensagem do WhatsApp sai detalhada.

- [ ] **Step 7: Commit**

```bash
git add components/cart.tsx
git commit -m "feat(checkout): seletores de envio/pagamento, total com frete/acréscimo e msg detalhada"
```

---

## Phase 9 — Painel de Pedidos: peso, envio, pagamento, total

### Task 25: Exibir peso/envio/pagamento/total no card do pedido

**Files:**
- Modify: `app/painel/pedidos/page.tsx`

- [ ] **Step 1: Adicionar as informações no card**

Em `app/painel/pedidos/page.tsx`, dentro do bloco que lista os itens (a `div` com `border-t border-border pt-2 space-y-1`), após o `.map` dos itens e antes de fechar essa `div`, adicione um resumo:

```tsx
                {o.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{it.quantity}x {it.productName} ({it.productCode}) — {it.size}/{it.color}</span>
                    <span>{fmt(it.unitPrice * it.quantity)}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-border/60 text-sm space-y-0.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>{fmt(o.itemsSubtotal || o.total)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Peso total</span><span>{(o.weightTotalGrams / 1000).toFixed(3).replace('.', ',')} kg</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Envio</span><span>{o.shippingLabel || 'A combinar'}{o.shippingPrice > 0 ? ` — ${fmt(o.shippingPrice)}` : ''}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pagamento</span><span>{o.paymentLabel || 'A combinar'}{o.paymentSurcharge > 0 ? ` — +${fmt(o.paymentSurcharge)}` : ''}</span>
                  </div>
                </div>
```

> O total final (`o.total`) já aparece no topo do card. As linhas acima detalham subtotal, peso, envio e pagamento.

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Expected: compila; card do pedido mostra peso total, envio, pagamento e subtotal.

- [ ] **Step 3: Commit**

```bash
git add app/painel/pedidos/page.tsx
git commit -m "feat(pedidos): card mostra peso total, envio, pagamento e subtotal"
```

---

## Phase 10 — Verificação final

### Task 26: Suíte, build e revisão manual mobile

**Files:** nenhum (verificação)

- [ ] **Step 1: Rodar toda a suíte**

Run: `pnpm test`
Expected: PASS (helpers de vitrine, peso, frete, acréscimo).

- [ ] **Step 2: Build de produção**

Run: `pnpm build`
Expected: build sem erros de tipo.

- [ ] **Step 3: Conferir fluxos no `pnpm dev` (de preferência no celular ou DevTools mobile)**

- [ ] Criar 2-3 categorias em `/painel/categorias`; tentar apagar uma com produto → bloqueia.
- [ ] Criar formas de envio (`/painel/envio`) e pagamento (`/painel/pagamento`).
- [ ] Cadastrar um produto com 1 cor + peso; na home aparece "Cor: X" sem botão.
- [ ] No carrinho: escolher envio/pagamento → Subtotal/Frete/Acréscimo/Total corretos; enviar → mensagem detalhada no WhatsApp.
- [ ] Em `/painel/pedidos`: card mostra peso total, envio, pagamento, total final.
- [ ] Aceitar o pedido (baixa de estoque) continua funcionando.

- [ ] **Step 4: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: ajustes finais da verificação mobile"
```

---

## Notas de execução

- **Migrations:** aplique-as no Supabase do projeto na ordem (0005→0009) antes de testar as telas que dependem das tabelas novas.
- **Acréscimo:** definido como `(subtotal + frete) × % + fixo`. Se a loja preferir só sobre o subtotal, ajustar em dois lugares: `buildOrder` (Task 8) e o cálculo do `cart.tsx` (Task 24, Step 1d) — manter os dois iguais.
- **Categoria do produto:** guarda o nome (texto). Renomear propaga; apagar é bloqueado se houver produto usando.
