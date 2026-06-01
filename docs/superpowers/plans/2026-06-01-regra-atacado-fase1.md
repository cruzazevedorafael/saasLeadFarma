# Regra de Atacado por Carrinho + Painel (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a Fase 1 (catálogo gerenciável pelo painel) já com a nova regra de preço: o carrinho vira **atacado** automaticamente quando atinge **N peças que contam** (padrão 4, configurável), com uma flag por produto ("não conta") para itens como meias.

**Architecture:** Supabase (Postgres + Auth + Storage) como fonte de dados. O app Next.js (App Router) lê produtos por uma camada de dados isolada (`lib/data/*`). A precificação passa a ser **derivada do carrinho inteiro** por funções puras testáveis (`lib/data/cart.helpers.ts`) — não há mais escolha manual varejo/atacado nem mínimo por produto. O painel (`/painel`, autenticado) faz o CRUD e tem um campo simples para o limite de atacado.

**Tech Stack:** Next.js 16 (App Router) · `@supabase/supabase-js` + `@supabase/ssr` · Supabase (Postgres/Auth/Storage) · Vitest + @testing-library/react · shadcn/ui + Tailwind v4 · react-hook-form + zod.

**Specs de referência:**
- [docs/superpowers/specs/2026-06-01-regra-atacado-design.md](../specs/2026-06-01-regra-atacado-design.md) (esta regra — autoritativo)
- [docs/superpowers/specs/2026-05-24-painel-karolla-fit-design.md](../specs/2026-05-24-painel-karolla-fit-design.md) (Fase 1 geral)

**Relação com o plano anterior:** este plano **substitui** as tasks 7–15 de
[2026-05-24-painel-fase-1-catalogo.md](2026-05-24-painel-fase-1-catalogo.md).
As tasks de plumbing inalteradas pela regra (autenticação, lista de produtos,
botões de ação/logout) são **reaproveitadas por referência** ao plano anterior,
onde o código está totalmente inline. As tasks 0–6 daquele plano (setup Supabase,
clientes, vitest, tipos/helpers/mappers iniciais) **já estão concluídas**
(commits no repo).

---

## Estrutura de arquivos (criado/alterado nesta entrega)

```
supabase/migrations/
  0002_seed_produtos.sql        # CRIAR: seed dos 12 produtos + variações (counts default true)
  0003_regra_atacado.sql        # CRIAR: + counts_for_wholesale, + wholesale_threshold, recria view pública
lib/data/
  types.ts                      # ALTERAR: -minWholesale, +countsForWholesale
  mappers.ts                    # ALTERAR: mapear counts_for_wholesale; parar min_wholesale
  mappers.test.ts               # ALTERAR: ajustar expectativas
  products.helpers.ts           # ALTERAR: remover priceForQuantity (regra antiga)
  products.helpers.test.ts      # ALTERAR: remover testes de priceForQuantity; fixture sem minWholesale
  cart.helpers.ts               # CRIAR: regra de preço por carrinho (puro)
  cart.helpers.test.ts          # CRIAR: testes da regra (TDD)
  settings.ts                   # CRIAR: getStoreSettings (inclui wholesale_threshold)
lib/store.ts                    # ALTERAR: tipo de dados, remove priceType/getTotalPrice
app/page.tsx                    # ALTERAR: Server Component que busca produtos + threshold
app/_components/catalog.tsx     # CRIAR: client component com busca/filtro/grid/cart (recebe props)
components/product-card.tsx     # ALTERAR: novo tipo, sem toggle, etiqueta "não conta", disponibilidade
components/cart.tsx             # ALTERAR: preço derivado do carrinho + banner de status + WhatsApp
lib/products.ts                 # REMOVER (substituído pela camada de dados)
app/painel/login/                       # (Task 10 — referência ao plano anterior)
app/painel/layout.tsx, page.tsx         # CRIAR: auth + home com campo de limite de atacado
app/painel/produtos/page.tsx            # (Task 11 — referência ao plano anterior)
app/painel/produtos/_components/produto-schema.ts(+test)  # ALTERAR: countsForWholesale
app/painel/produtos/_components/produto-form.tsx          # CRIAR: form com checkbox
app/painel/produtos/actions.ts          # CRIAR: CRUD grava counts_for_wholesale
app/painel/produtos/novo/page.tsx, [id]/page.tsx          # CRIAR
app/painel/settings-actions.ts          # CRIAR: setWholesaleThreshold
app/painel/produtos/_components/produto-actions.tsx       # (Task 15 — referência ao plano anterior)
```

---

## Task 0: Pré-requisito manual — Supabase + `.env.local`

> ⚠️ **Tarefa manual** (Wesllei), uma vez. Sem teste automatizado. Bloqueia todo
> o resto (sem isso o app não conecta no banco e `/painel` dá 500).

- [ ] **Step 1: Projeto Supabase + chaves + usuário admin**

Seguir **Task 0 (Steps 1–3)** e **Task 1 (Steps 1–2)** do plano anterior
[2026-05-24-painel-fase-1-catalogo.md](2026-05-24-painel-fase-1-catalogo.md):
criar projeto `karolla-fit`, copiar `Project URL` / `anon` / `service_role`,
criar o usuário admin (e-mail+senha da dona), e gravar tudo em `.env.local`
(modelo já existe em `.env.example`).

- [ ] **Step 2: Criar o bucket de imagens**

No Supabase → **Storage → New bucket**: nome `produtos`, **Public = ON**.

- [ ] **Step 3: Confirmar**

`.env.local` preenchido e bucket criado. Avisar para seguir para a Task 1.

---

## Task 1: Banco — seed (0002) + regra de atacado (0003)

**Files:**
- Create: `supabase/migrations/0002_seed_produtos.sql`
- Create: `supabase/migrations/0003_regra_atacado.sql`

- [ ] **Step 1: Escrever o seed (`0002_seed_produtos.sql`)**

> `counts_for_wholesale` ainda não existe nesta migration (é criada na 0003 com
> default `true`, que faz backfill destas linhas). Por isso o seed não o
> referencia. Estoque inicial 5 por variação; custo 0 (a dona ajusta depois).

```sql
-- supabase/migrations/0002_seed_produtos.sql

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('LEG-001','Legging Suplex Premium','Leggings','Legging de alta compressão com tecido suplex premium. Cintura alta que modela o corpo.','https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=500&fit=crop',0,49.90,89.90,1,1)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Cinza','Azul Marinho']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('TOP-001','Top Nadador Fitness','Tops','Top nadador com sustentação média-alta. Ideal para treinos intensos.','https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop',0,34.90,59.90,1,2)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Rosa','Verde Neon']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('CONJ-001','Conjunto Seamless','Conjuntos','Conjunto sem costuras que proporciona conforto máximo. Legging + Top combinando.','https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',0,89.90,159.90,1,3)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Nude','Cinza']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('SHORT-001','Short Saia Academia','Shorts','Short saia com shorts interno anti-transparência. Perfeito para corrida.','https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=500&fit=crop',0,39.90,69.90,1,4)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Vermelho','Branco']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('REG-001','Regata Dry Fit','Regatas','Regata com tecnologia dry fit que mantém o corpo seco durante o treino.','https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&h=500&fit=crop',0,29.90,49.90,1,5)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Branco','Preto','Rosa']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('CALC-001','Calça Jogger Fitness','Calcas','Calça jogger estilo esportivo com bolsos laterais e punhos nas pernas.','https://images.unsplash.com/photo-1556906918-c3071bd15252?w=400&h=500&fit=crop',0,69.90,119.90,1,6)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Cinza Mescla','Verde Militar']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('BODY-001','Body Fitness Decote V','Bodies','Body com decote V e costas nadador. Tecido com proteção UV.','https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop',0,44.90,79.90,1,7)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Nude','Bordô']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('BERM-001','Bermuda Ciclista','Bermudas','Bermuda ciclista cintura alta com compressão. Não marca celulite.','https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&h=500&fit=crop',0,34.90,59.90,1,8)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Cinza','Rosa']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('JAQ-001','Jaqueta Corta Vento','Jaquetas','Jaqueta leve corta vento com capuz. Ideal para corridas ao ar livre.','https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=500&fit=crop',0,74.90,129.90,1,9)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Verde Neon','Branco']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('CROP-001','Cropped Manga Longa','Croppeds','Cropped manga longa com proteção solar UV50+. Design moderno.','https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400&h=500&fit=crop',0,39.90,69.90,1,10)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Branco','Cinza']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('LEG-002','Legging Empina Bumbum','Leggings','Legging com tecnologia que realça os glúteos. Costura scrunch no bumbum.','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=500&fit=crop',0,54.90,99.90,1,11)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Vinho','Azul Petróleo']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('TOP-002','Top Long Line','Tops','Top alongado com bojo removível. Alta sustentação e conforto.','https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',0,37.90,64.90,1,12)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Lilás','Verde Água']) as c(color);
```

- [ ] **Step 2: Escrever a migration da regra (`0003_regra_atacado.sql`)**

```sql
-- supabase/migrations/0003_regra_atacado.sql

-- flag por produto: conta (ou não) para atingir o atacado
alter table public.products
  add column counts_for_wholesale boolean not null default true;

-- limite global de peças para o carrinho virar atacado
alter table public.store_settings
  add column wholesale_threshold int not null default 4;

-- recriar a view pública expondo counts_for_wholesale (append no fim das colunas)
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale
  from public.products
  where active = true;
```

- [ ] **Step 3: Rodar no Supabase**

No **SQL Editor**, rode o conteúdo de `0002_seed_produtos.sql` → "Success".
Depois rode `0003_regra_atacado.sql` → "Success".

- [ ] **Step 4: Verificar**

No SQL Editor:
- `select count(*) from public.products;` → **12**.
- `select count(*) from public.product_variants;` → **144** (12 × 4 tamanhos × 3 cores).
- `select count(*) from public.products where counts_for_wholesale;` → **12** (todos true por padrão).
- `select wholesale_threshold from public.store_settings;` → **4**.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_seed_produtos.sql supabase/migrations/0003_regra_atacado.sql
git commit -m "feat(db): seed dos 12 produtos + regra de atacado (counts_for_wholesale, wholesale_threshold)"
```

---

## Task 2: Tipos e mappers (countsForWholesale)

**Files:**
- Modify: `lib/data/types.ts`
- Modify: `lib/data/mappers.ts`
- Modify: `lib/data/mappers.test.ts`

- [ ] **Step 1: Atualizar o teste do mapper (deve falhar)**

Substituir o conteúdo de `lib/data/mappers.test.ts` por:

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
  it('mapeia campos, números e a flag de atacado', () => {
    const row = {
      id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
      image_url: null, price_cost: '20.00', price_wholesale: '49.90', price_retail: '89.90',
      counts_for_wholesale: true, active: true, sort_order: 0,
    }
    expect(mapProductRow(row)).toMatchObject({
      id: '1', code: 'LEG-001', priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9,
      countsForWholesale: true, imageUrl: null,
    })
  })

  it('countsForWholesale default true quando ausente', () => {
    expect(mapProductRow({ id: '2', code: 'X', name: 'Y' }).countsForWholesale).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test mappers`
Expected: FAIL (`countsForWholesale` indefinido / propriedade não existe no tipo).

- [ ] **Step 3: Atualizar `types.ts`**

Em `lib/data/types.ts`, na interface `Product`, **remover** a linha
`minWholesale: number` e **adicionar** `countsForWholesale: boolean`:

```ts
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
  countsForWholesale: boolean
  active: boolean
  sortOrder: number
}
```

(As interfaces `ProductVariant` e `ProductWithVariants` ficam iguais.)

- [ ] **Step 4: Atualizar `mappers.ts`**

Em `lib/data/mappers.ts`, dentro de `mapProductRow`, **remover** a linha
`minWholesale: Number(r.min_wholesale ?? 1),` e **adicionar**:

```ts
    countsForWholesale: r.counts_for_wholesale ?? true,
```

- [ ] **Step 5: Rodar (deve passar)**

Run: `pnpm test mappers`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/data/types.ts lib/data/mappers.ts lib/data/mappers.test.ts
git commit -m "feat(data): tipo de produto com countsForWholesale (remove minWholesale)"
```

---

## Task 3: Remover regra antiga de preço por produto

**Files:**
- Modify: `lib/data/products.helpers.ts`
- Modify: `lib/data/products.helpers.test.ts`

- [ ] **Step 1: Atualizar os testes (deve falhar a compilação)**

Substituir o conteúdo de `lib/data/products.helpers.test.ts` por (sem
`priceForQuantity`, fixture com `countsForWholesale` no lugar de `minWholesale`):

```ts
// lib/data/products.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { sizesOf, colorsOf, isVariantAvailable } from './products.helpers'
import type { ProductWithVariants } from './types'

const p: ProductWithVariants = {
  id: '1', code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  imageUrl: null, priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9,
  countsForWholesale: true, active: true, sortOrder: 0,
  variants: [
    { id: 'v1', productId: '1', size: 'M', color: 'Preto', stock: 3 },
    { id: 'v2', productId: '1', size: 'G', color: 'Preto', stock: 0 },
    { id: 'v3', productId: '1', size: 'M', color: 'Rosa', stock: 5 },
  ],
}

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

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test products.helpers`
Expected: FAIL (a fixture antiga usava `minWholesale`, agora removido do tipo).

- [ ] **Step 3: Atualizar `products.helpers.ts`**

Em `lib/data/products.helpers.ts`, **remover** a função `priceForQuantity`
(as outras três permanecem):

```ts
// lib/data/products.helpers.ts
import type { ProductWithVariants } from './types'

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

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test products.helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/products.helpers.ts lib/data/products.helpers.test.ts
git commit -m "refactor(data): remove priceForQuantity (regra de preço por produto)"
```

---

## Task 4: Store do carrinho (tipo novo, sem priceType)

**Files:**
- Modify: `lib/store.ts`

- [ ] **Step 1: Reescrever `lib/store.ts`**

`CartItem` perde `priceType` (o preço passa a ser derivado do carrinho).
`getTotalPrice` sai (a precificação vai para `cart.helpers.ts`).

```ts
// lib/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/lib/data/types'

export type { Product }

export interface CartItem {
  product: Product
  quantity: number
  size: string
  color: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string, size: string, color: string) => void
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.product.id === item.product.id && i.size === item.size && i.color === item.color
          )
          if (existingIndex >= 0) {
            const newItems = [...state.items]
            newItems[existingIndex].quantity += item.quantity
            return { items: newItems }
          }
          return { items: [...state.items, item] }
        })
      },
      removeItem: (productId, size, color) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.product.id === productId && i.size === size && i.color === color)
          ),
        }))
      },
      updateQuantity: (productId, size, color, quantity) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId && i.size === size && i.color === color
              ? { ...i, quantity }
              : i
          ),
        }))
      },
      clearCart: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
    }),
    {
      name: 'karolla-cart',
    }
  )
)
```

> A app não compila 100% ainda (product-card/cart usam o tipo antigo) — isso é
> resolvido nas Tasks 7–9. Não rode `tsc` como gate aqui; o gate é a Task 5.

- [ ] **Step 2: Commit**

```bash
git add lib/store.ts
git commit -m "refactor(store): carrinho usa tipo de dados e remove priceType/getTotalPrice"
```

---

## Task 5: Regra de preço por carrinho (TDD — coração)

**Files:**
- Create: `lib/data/cart.helpers.ts`
- Test: `lib/data/cart.helpers.test.ts`

- [ ] **Step 1: Escrever os testes (deve falhar)**

```ts
// lib/data/cart.helpers.test.ts
import { describe, it, expect } from 'vitest'
import {
  countingQuantity, cartPriceType, unitPriceFor, cartTotal, piecesUntilWholesale,
} from './cart.helpers'
import type { CartItem } from '@/lib/store'
import type { Product } from './types'

function product(over: Partial<Product>): Product {
  return {
    id: 'p', code: 'C', name: 'X', category: '', description: '', imageUrl: null,
    priceCost: 0, priceWholesale: 50, priceRetail: 90, countsForWholesale: true,
    active: true, sortOrder: 0, ...over,
  }
}
const mk = (p: Product, quantity: number): CartItem => ({ product: p, quantity, size: 'M', color: 'Preto' })

const legging = product({ priceWholesale: 50, priceRetail: 90, countsForWholesale: true })
const meia = product({ id: 'm', priceWholesale: 8, priceRetail: 12, countsForWholesale: false })

describe('countingQuantity', () => {
  it('soma só as peças que contam', () => {
    expect(countingQuantity([mk(legging, 1), mk(meia, 3)])).toBe(1)
  })
})

describe('cartPriceType', () => {
  it('atacado quando atinge o limite (4 iguais contam)', () => {
    expect(cartPriceType([mk(legging, 4)], 4)).toBe('wholesale')
  })
  it('varejo abaixo do limite', () => {
    expect(cartPriceType([mk(legging, 3)], 4)).toBe('retail')
  })
  it('1 legging + 3 meias = varejo (meia não conta)', () => {
    expect(cartPriceType([mk(legging, 1), mk(meia, 3)], 4)).toBe('retail')
  })
  it('limite configurável', () => {
    expect(cartPriceType([mk(legging, 2)], 2)).toBe('wholesale')
  })
})

describe('cartTotal', () => {
  it('atingido o atacado, a meia também sai no atacado', () => {
    const items = [mk(legging, 4), mk(meia, 2)]
    const type = cartPriceType(items, 4) // 'wholesale'
    expect(cartTotal(items, type)).toBe(4 * 50 + 2 * 8) // 216
  })
  it('no varejo soma preços de varejo', () => {
    const items = [mk(legging, 1), mk(meia, 3)]
    const type = cartPriceType(items, 4) // 'retail'
    expect(cartTotal(items, type)).toBe(1 * 90 + 3 * 12) // 126
  })
})

describe('unitPriceFor', () => {
  it('escolhe o preço certo', () => {
    expect(unitPriceFor(legging, 'wholesale')).toBe(50)
    expect(unitPriceFor(legging, 'retail')).toBe(90)
  })
})

describe('piecesUntilWholesale', () => {
  it('quantas peças que contam faltam', () => {
    expect(piecesUntilWholesale([mk(legging, 1)], 4)).toBe(3)
  })
  it('zero quando já atingiu', () => {
    expect(piecesUntilWholesale([mk(legging, 4)], 4)).toBe(0)
  })
  it('meias não reduzem o que falta', () => {
    expect(piecesUntilWholesale([mk(legging, 1), mk(meia, 5)], 4)).toBe(3)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test cart.helpers`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar `cart.helpers.ts`**

```ts
// lib/data/cart.helpers.ts
import type { CartItem } from '@/lib/store'

export type PriceType = 'retail' | 'wholesale'

/** Soma das quantidades apenas dos itens cujo produto conta para o atacado. */
export function countingQuantity(items: CartItem[]): number {
  return items.reduce((acc, i) => acc + (i.product.countsForWholesale ? i.quantity : 0), 0)
}

/** O carrinho inteiro é atacado quando as peças que contam atingem o limite. */
export function cartPriceType(items: CartItem[], threshold: number): PriceType {
  return countingQuantity(items) >= threshold ? 'wholesale' : 'retail'
}

export function unitPriceFor(
  product: { priceWholesale: number; priceRetail: number },
  priceType: PriceType,
): number {
  return priceType === 'wholesale' ? product.priceWholesale : product.priceRetail
}

/** Total do carrinho aplicando o MESMO tipo de preço a todos os itens. */
export function cartTotal(items: CartItem[], priceType: PriceType): number {
  return items.reduce((acc, i) => acc + unitPriceFor(i.product, priceType) * i.quantity, 0)
}

/** Quantas peças que contam ainda faltam para virar atacado (0 se já atingiu). */
export function piecesUntilWholesale(items: CartItem[], threshold: number): number {
  return Math.max(0, threshold - countingQuantity(items))
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test cart.helpers`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add lib/data/cart.helpers.ts lib/data/cart.helpers.test.ts
git commit -m "feat(data): regra de preço por carrinho (atacado por quantidade + flag)"
```

---

## Task 6: Leitura das configurações (threshold)

**Files:**
- Create: `lib/data/settings.ts`

- [ ] **Step 1: Implementar `getStoreSettings`**

```ts
// lib/data/settings.ts
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface StoreSettings {
  storeName: string
  whatsappNumber: string
  reservationMinutes: number
  wholesaleThreshold: number
}

const FALLBACK: StoreSettings = {
  storeName: 'Karolla Fit',
  whatsappNumber: '',
  reservationMinutes: 10,
  wholesaleThreshold: 4,
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('store_name, whatsapp_number, reservation_minutes, wholesale_threshold')
    .eq('id', 1)
    .single()
  if (error || !data) return FALLBACK
  return {
    storeName: data.store_name ?? FALLBACK.storeName,
    whatsappNumber: data.whatsapp_number ?? FALLBACK.whatsappNumber,
    reservationMinutes: Number(data.reservation_minutes ?? FALLBACK.reservationMinutes),
    wholesaleThreshold: Number(data.wholesale_threshold ?? FALLBACK.wholesaleThreshold),
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros nos arquivos `lib/data/*` (os erros restantes em
`components/*` e `app/page.tsx` são esperados e resolvidos nas Tasks 7–9).

- [ ] **Step 3: Commit**

```bash
git add lib/data/settings.ts
git commit -m "feat(data): getStoreSettings com wholesale_threshold"
```

---

## Task 7: Página pública busca produtos + threshold (Server Component)

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/category-filter.tsx`
- Create: `app/_components/catalog.tsx`
- Delete: `lib/products.ts`

- [ ] **Step 1: `CategoryFilter` recebe `categories` por prop**

Hoje ele importa `categories` de `@/lib/products` (que será removido). Trocar
por prop. Em `components/category-filter.tsx`, **remover** a linha
`import { categories } from '@/lib/products'` e ajustar a assinatura:

```tsx
interface CategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
```

(O corpo — `categories.map(...)` — permanece igual.)

- [ ] **Step 2: Criar `app/_components/catalog.tsx` (client)**

Move a UI atual (busca/filtro/grid/cart) para um client component que recebe
`products` e `threshold` por props. As categorias são **derivadas** dos produtos
e passadas ao `CategoryFilter`. O `threshold` é repassado ao `<Cart/>`.

```tsx
// app/_components/catalog.tsx
'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { CategoryFilter } from '@/components/category-filter'
import { ProductCard } from '@/components/product-card'
import { Cart } from '@/components/cart'
import { Search } from 'lucide-react'
import type { ProductWithVariants } from '@/lib/data/types'

export function Catalog({ products, threshold }: { products: ProductWithVariants[]; threshold: number }) {
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')

  const categories = useMemo(
    () => ['Todos', ...new Set(products.map((p) => p.category).filter(Boolean))],
    [products],
  )

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [products, selectedCategory, searchQuery])

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />

      <section className="sticky top-14 md:top-20 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 py-3 md:py-4">
        <div className="container mx-auto px-3 md:px-4 space-y-3 md:space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md mx-auto"
          >
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 md:h-12 pl-10 md:pl-12 pr-4 rounded-full bg-muted border border-border/50 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#CFFF04]/50 focus:border-[#CFFF04]/50 transition-all"
              />
            </div>
          </motion.div>

          <CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        </div>
      </section>

      <section className="py-4 md:py-12">
        <div className="container mx-auto px-3 md:px-4">
          <motion.div
            key={filteredProducts.length}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 md:mb-6 flex items-center justify-between"
          >
            <p className="text-xs md:text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{filteredProducts.length}</span>{' '}
              produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>
            {selectedCategory !== 'Todos' && (
              <button onClick={() => setSelectedCategory('Todos')} className="text-xs md:text-sm text-[#CFFF04] hover:underline">
                Ver todos
              </button>
            )}
          </motion.div>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} threshold={threshold} />
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-12 md:py-20 text-center">
              <div className="mb-4 rounded-full bg-muted p-4 md:p-6">
                <Search className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base md:text-lg font-semibold">Nenhum produto encontrado</h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Tente buscar por outro termo ou categoria</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('Todos') }}
                className="mt-4 text-xs md:text-sm text-[#CFFF04] hover:underline"
              >
                Limpar filtros
              </button>
            </motion.div>
          )}
        </div>
      </section>

      <Cart threshold={threshold} />
    </main>
  )
}
```

> O `<footer>` atual foi omitido por brevidade do catálogo; mantenha-o se desejar
> movendo o mesmo bloco `<footer>...</footer>` do `app/page.tsx` original para
> antes de `<Cart/>` aqui. (Não é requisito da regra de atacado.)

- [ ] **Step 3: Reescrever `app/page.tsx` (Server Component)**

```tsx
// app/page.tsx
import { Catalog } from './_components/catalog'
import { getPublicProducts } from '@/lib/data/products'
import { getStoreSettings } from '@/lib/data/settings'

export default async function Home() {
  const [products, settings] = await Promise.all([getPublicProducts(), getStoreSettings()])
  return <Catalog products={products} threshold={settings.wholesaleThreshold} />
}
```

- [ ] **Step 4: Remover o arquivo estático e conferir imports órfãos**

Run: `git rm lib/products.ts`
Run: `grep -rn "@/lib/products'" app components` → **sem resultados** (o
`category-filter` já recebe `categories` por prop após o Step 1).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/_components/catalog.tsx components/category-filter.tsx
git rm lib/products.ts
git commit -m "feat(site): página busca produtos do supabase + threshold; remove products.ts estático"
```

---

## Task 8: Card de produto (sem toggle, com flag e disponibilidade)

**Files:**
- Modify: `components/product-card.tsx`

- [ ] **Step 1: Reescrever `components/product-card.tsx`**

Remove o toggle varejo/atacado e o `priceType`. Mostra os dois preços como
informação, etiqueta "não conta pro atacado" quando aplicável, e desabilita a
adição se a variação selecionada estiver esgotada.

```tsx
// components/product-card.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useCartStore } from '@/lib/store'
import type { ProductWithVariants } from '@/lib/data/types'
import { sizesOf, colorsOf, isVariantAvailable } from '@/lib/data/products.helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Minus, ShoppingBag, Check } from 'lucide-react'

interface ProductCardProps {
  product: ProductWithVariants
  index: number
  threshold: number
}

export function ProductCard({ product, index, threshold }: ProductCardProps) {
  const sizes = sizesOf(product)
  const colors = colorsOf(product)
  const [selectedSize, setSelectedSize] = useState(sizes[0] ?? '')
  const [selectedColor, setSelectedColor] = useState(colors[0] ?? '')
  const [quantity, setQuantity] = useState(1)
  const [isAdded, setIsAdded] = useState(false)

  const addItem = useCartStore((state) => state.addItem)
  const available = isVariantAvailable(product, selectedSize, selectedColor)
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

  const handleAddToCart = () => {
    if (!available) return
    addItem({ product, quantity, size: selectedSize, color: selectedColor })
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-xl md:rounded-2xl border border-border/50 bg-card"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={product.imageUrl ?? '/placeholder.svg'}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <Badge className="absolute top-2 left-2 md:top-3 md:left-3 bg-[#CFFF04] text-black font-medium hover:bg-[#CFFF04] text-[10px] md:text-xs px-2 py-0.5 md:px-2.5 md:py-1">
          {product.category}
        </Badge>
        {!product.countsForWholesale && (
          <Badge variant="secondary" className="absolute top-2 right-2 md:top-3 md:right-3 bg-black/80 text-amber-300 border border-amber-300/30 text-[9px] md:text-xs">
            Não conta p/ atacado
          </Badge>
        )}
      </div>

      <div className="p-3 md:p-4 space-y-3 md:space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm md:text-lg text-foreground leading-tight">{product.name}</h3>
          </div>
          <span className="text-[10px] md:text-xs text-muted-foreground">Cód: {product.code}</span>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
        </div>

        {/* Preços (informativos — a regra acontece no carrinho) */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs text-muted-foreground">Varejo</span>
            <span className="text-xl md:text-2xl font-bold text-foreground">{fmt(product.priceRetail)}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] md:text-xs text-muted-foreground">Atacado ({threshold}+ peças)</span>
            <span className="text-lg md:text-xl font-bold text-[#CFFF04]">{fmt(product.priceWholesale)}</span>
          </div>
        </div>

        {/* Tamanho */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">Tamanho</span>
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
        </div>

        {/* Cor */}
        <div>
          <span className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2 block">Cor: {selectedColor}</span>
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
        </div>

        {/* Quantidade */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] md:text-xs text-muted-foreground">Quantidade</span>
          <div className="flex items-center gap-2 md:gap-3 bg-muted rounded-lg p-0.5 md:p-1">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors">
              <Minus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
            <span className="w-6 md:w-8 text-center font-semibold text-sm md:text-base">{quantity}</span>
            <button onClick={() => setQuantity(quantity + 1)} className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors">
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            onClick={handleAddToCart}
            disabled={!available}
            className={`w-full h-10 md:h-12 text-sm md:text-base font-semibold transition-all ${
              isAdded ? 'bg-green-500 hover:bg-green-500 text-white' : 'bg-[#CFFF04] hover:bg-[#b8e600] text-black'
            } ${!available ? 'opacity-60' : ''}`}
          >
            <AnimatePresence mode="wait">
              {!available ? (
                <span>Esgotado</span>
              ) : isAdded ? (
                <motion.div key="added" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1.5 md:gap-2">
                  <Check className="h-4 w-4 md:h-5 md:w-5" /> Adicionado!
                </motion.div>
              ) : (
                <motion.div key="add" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-1.5 md:gap-2">
                  <ShoppingBag className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">Adicionar ao Carrinho</span>
                  <span className="sm:hidden">Adicionar</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/product-card.tsx
git commit -m "feat(site): card sem toggle, com código, flag 'não conta' e disponibilidade"
```

---

## Task 9: Carrinho com preço derivado + banner de status

**Files:**
- Modify: `components/cart.tsx`

- [ ] **Step 1: Reescrever `components/cart.tsx`**

`Cart` recebe `threshold`. Calcula `priceType` e `total` por `cart.helpers`.
Mostra banner ("Faltam N peças pro atacado" / "✓ Atacado aplicado"). A mensagem
do WhatsApp e o resumo usam o tipo/total corretos. `CartItemCard` recebe
`priceType`.

```tsx
// components/cart.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore, CartItem } from '@/lib/store'
import { cartPriceType, cartTotal, unitPriceFor, piecesUntilWholesale, type PriceType } from '@/lib/data/cart.helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShoppingCart, X, Trash2, Plus, Minus, Send, User, Phone, Tag } from 'lucide-react'

const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`

export function Cart({ threshold }: { threshold: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { items, removeItem, updateQuantity, clearCart, getTotalItems } = useCartStore()

  const priceType: PriceType = cartPriceType(items, threshold)
  const total = cartTotal(items, priceType)
  const faltam = piecesUntilWholesale(items, threshold)
  const totalItems = getTotalItems()

  const generateOrderText = () => {
    const date = new Date().toLocaleDateString('pt-BR')
    let text = `*PEDIDO KAROLLA FIT*\n`
    text += `Data: ${date}\n\n`
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
    text += `*TOTAL GERAL: ${formatPrice(total)}*\n`
    text += `━━━━━━━━━━━━━━━━━━\n\n`
    text += `_Pedido enviado pelo Menu Digital KAROLLA FIT_`
    return text
  }

  const handleSendOrder = () => {
    if (!customerName.trim() || !customerPhone.trim()) return
    setIsLoading(true)
    const orderText = generateOrderText()
    const phoneNumber = '5500000000000' // configurável na Fase 2
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(orderText)}`, '_blank')
    setTimeout(() => {
      setIsLoading(false)
      clearCart()
      setShowCheckout(false)
      setIsOpen(false)
      setCustomerName('')
      setCustomerPhone('')
    }, 1000)
  }

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-1.5 md:gap-2 rounded-full bg-[#CFFF04] px-4 py-3 md:px-6 md:py-4 text-black font-semibold shadow-lg shadow-[#CFFF04]/20"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
        <span className="text-sm md:text-base">Carrinho</span>
        {totalItems > 0 && (
          <motion.span key={totalItems} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black text-[#CFFF04] text-xs md:text-sm">
            {totalItems}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-full sm:max-w-md overflow-hidden bg-background border-l border-border shadow-2xl"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-[#CFFF04]/10">
                      <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-[#CFFF04]" />
                    </div>
                    <div>
                      <h2 className="text-base md:text-lg font-semibold">Seu Carrinho</h2>
                      <p className="text-xs md:text-sm text-muted-foreground">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-muted transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Banner de status do atacado */}
                {items.length > 0 && (
                  <div className={`flex items-center gap-2 px-3 md:px-4 py-2 text-xs md:text-sm border-b border-border ${priceType === 'wholesale' ? 'bg-[#CFFF04]/15 text-[#CFFF04]' : 'bg-muted/40 text-muted-foreground'}`}>
                    <Tag className="h-4 w-4" />
                    {priceType === 'wholesale'
                      ? '✓ Preço de atacado aplicado'
                      : `Faltam ${faltam} ${faltam === 1 ? 'peça' : 'peças'} que contam pro atacado`}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-3 md:p-4">
                  <AnimatePresence mode="popLayout">
                    {!showCheckout ? (
                      <motion.div key="cart-items" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 md:space-y-4">
                        {items.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                            <div className="mb-4 rounded-full bg-muted p-4 md:p-6">
                              <ShoppingCart className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-sm md:text-base">Carrinho vazio</h3>
                            <p className="text-xs md:text-sm text-muted-foreground mt-1">Adicione produtos para comecar</p>
                          </div>
                        ) : (
                          items.map((item, index) => (
                            <CartItemCard
                              key={`${item.product.id}-${item.size}-${item.color}`}
                              item={item}
                              index={index}
                              priceType={priceType}
                              onRemove={() => removeItem(item.product.id, item.size, item.color)}
                              onUpdateQuantity={(qty) => updateQuantity(item.product.id, item.size, item.color, qty)}
                            />
                          ))
                        )}
                      </motion.div>
                    ) : (
                      <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4 md:space-y-6">
                        <div className="text-center">
                          <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Finalizar Pedido</h3>
                          <p className="text-xs md:text-sm text-muted-foreground">Preencha seus dados para enviar o pedido via WhatsApp</p>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                          <div className="space-y-1.5 md:space-y-2">
                            <Label htmlFor="name" className="text-xs md:text-sm">Seu Nome</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input id="name" placeholder="Digite seu nome" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="pl-10 h-10 md:h-12 bg-muted border-border text-sm md:text-base" />
                            </div>
                          </div>
                          <div className="space-y-1.5 md:space-y-2">
                            <Label htmlFor="phone" className="text-xs md:text-sm">Seu Telefone</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input id="phone" placeholder="(00) 00000-0000" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="pl-10 h-10 md:h-12 bg-muted border-border text-sm md:text-base" />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-muted/50 p-3 md:p-4 space-y-2 md:space-y-3">
                          <h4 className="font-semibold text-xs md:text-sm">Resumo do Pedido ({priceType === 'wholesale' ? 'Atacado' : 'Varejo'})</h4>
                          {items.map((item) => {
                            const price = unitPriceFor(item.product, priceType)
                            return (
                              <div key={`${item.product.id}-${item.size}-${item.color}`} className="flex justify-between text-xs md:text-sm">
                                <span className="text-muted-foreground">{item.quantity}x {item.product.name} ({item.size})</span>
                                <span>{formatPrice(price * item.quantity)}</span>
                              </div>
                            )
                          })}
                          <div className="border-t border-border pt-2 md:pt-3 flex justify-between font-semibold text-sm md:text-base">
                            <span>Total</span>
                            <span className="text-[#CFFF04]">{formatPrice(total)}</span>
                          </div>
                        </div>

                        <button onClick={() => setShowCheckout(false)} className="text-xs md:text-sm text-muted-foreground hover:text-foreground underline">Voltar ao carrinho</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {items.length > 0 && (
                  <div className="border-t border-border p-3 md:p-4 space-y-3 md:space-y-4 bg-card">
                    {!showCheckout && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm md:text-base text-muted-foreground">Total</span>
                        <span className="text-xl md:text-2xl font-bold text-[#CFFF04]">{formatPrice(total)}</span>
                      </div>
                    )}
                    {showCheckout ? (
                      <Button onClick={handleSendOrder} disabled={!customerName.trim() || !customerPhone.trim() || isLoading} className="w-full h-12 md:h-14 bg-[#25D366] hover:bg-[#128C7E] text-white text-base md:text-lg font-semibold">
                        {isLoading ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <><Send className="h-4 w-4 md:h-5 md:w-5 mr-2" /> Enviar pelo WhatsApp</>
                        )}
                      </Button>
                    ) : (
                      <Button onClick={() => setShowCheckout(true)} className="w-full h-12 md:h-14 bg-[#CFFF04] hover:bg-[#b8e600] text-black text-base md:text-lg font-semibold">Continuar</Button>
                    )}
                    {!showCheckout && (
                      <button onClick={clearCart} className="w-full text-xs md:text-sm text-muted-foreground hover:text-destructive transition-colors">Limpar carrinho</button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function CartItemCard({ item, index, priceType, onRemove, onUpdateQuantity }: {
  item: CartItem
  index: number
  priceType: PriceType
  onRemove: () => void
  onUpdateQuantity: (qty: number) => void
}) {
  const price = unitPriceFor(item.product, priceType)

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ delay: index * 0.05 }} className="flex gap-3 rounded-xl bg-muted/30 p-3 border border-border/50">
      <div className="relative h-20 w-20 overflow-hidden rounded-lg bg-muted flex-shrink-0">
        <img src={item.product.imageUrl ?? '/placeholder.svg'} alt={item.product.name} className="h-full w-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
        <div className="flex gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{item.size}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{item.color}</span>
          {!item.product.countsForWholesale && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">não conta</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2 bg-background rounded-lg p-0.5">
            <button onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))} className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors">
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
            <button onClick={() => onUpdateQuantity(item.quantity + 1)} className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="font-semibold text-[#CFFF04]">{formatPrice(price * item.quantity)}</span>
        </div>
      </div>
      <button onClick={onRemove} className="self-start p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verificar tipos + testes**

Run: `pnpm exec tsc --noEmit`
Expected: **sem erros** (todo o site público migrado).
Run: `pnpm test`
Expected: PASS (mappers, products.helpers, cart.helpers).

- [ ] **Step 3: Verificar no navegador**

Com o dev server rodando (`pnpm dev`), abrir o site:
1. Produtos aparecem do banco, com código e preços varejo/atacado.
2. Adicionar 3 leggings → carrinho mostra "Faltam 1 peça pro atacado", total no **varejo**.
3. Adicionar +1 (4 no total) → banner "✓ Preço de atacado aplicado", total recalcula no **atacado**.
4. Adicionar 1 legging + 3 itens marcados "não conta" (após a Task 14 dar pra marcar; por ora teste alterando `counts_for_wholesale=false` de um produto no SQL Editor) → continua **varejo**.

- [ ] **Step 4: Commit**

```bash
git add components/cart.tsx
git commit -m "feat(site): carrinho aplica atacado por quantidade + banner de status"
```

---

## Task 10: Autenticação do painel

**Files:**
- Create: `app/painel/login/page.tsx`, `app/painel/login/actions.ts`, `app/painel/layout.tsx`

- [ ] **Step 1: Implementar login + proteção**

Executar **exatamente a Task 9 (Steps 1–3, 5–6)** do plano anterior
[2026-05-24-painel-fase-1-catalogo.md](2026-05-24-painel-fase-1-catalogo.md)
(`login/actions.ts` com `login`/`logout`, página de login, e `layout.tsx`). O
código está inline lá. **Não** crie o `app/painel/page.tsx` daquela task — a home
do painel é definida na Task 14 deste plano (inclui o campo de limite de atacado).

- [ ] **Step 2: Commit**

```bash
git add app/painel/login app/painel/layout.tsx
git commit -m "feat(painel): autenticação (login/logout) e proteção de rotas"
```

---

## Task 11: Lista de produtos no painel

**Files:**
- Create: `app/painel/produtos/page.tsx`

- [ ] **Step 1: Implementar a lista**

Executar **a Task 10 (Step 1)** do plano anterior — Server Component que checa
`getUser()`, chama `getAdminProducts()` e renderiza a tabela (mini foto, código,
nome, categoria, preços, estoque total, ativo, link Editar, botão "Novo
produto"). A coluna de "mín. atacado" **não** existe mais; em seu lugar mostre
uma coluna **"Conta atacado"** com Sim/Não (`produto.countsForWholesale`).

- [ ] **Step 2: Commit**

```bash
git add app/painel/produtos/page.tsx
git commit -m "feat(painel): lista de produtos com coluna 'conta atacado'"
```

---

## Task 12: Schema de validação do produto (countsForWholesale)

**Files:**
- Create: `app/painel/produtos/_components/produto-schema.ts`
- Test: `app/painel/produtos/_components/produto-schema.test.ts`

- [ ] **Step 1: Escrever os testes (deve falhar)**

```ts
// app/painel/produtos/_components/produto-schema.test.ts
import { describe, it, expect } from 'vitest'
import { produtoSchema } from './produto-schema'

const valido = {
  code: 'LEG-001', name: 'Legging', category: 'Leggings', description: '',
  priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, countsForWholesale: true,
  active: true,
  variants: [{ size: 'M', color: 'Preto', stock: 3 }],
}

describe('produtoSchema', () => {
  it('aceita produto válido', () => {
    expect(produtoSchema.safeParse(valido).success).toBe(true)
  })
  it('countsForWholesale default true quando ausente', () => {
    const { countsForWholesale, ...semFlag } = valido
    const parsed = produtoSchema.parse(semFlag)
    expect(parsed.countsForWholesale).toBe(true)
  })
  it('aceita countsForWholesale false', () => {
    const parsed = produtoSchema.parse({ ...valido, countsForWholesale: false })
    expect(parsed.countsForWholesale).toBe(false)
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
  countsForWholesale: z.boolean().default(true),
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
git commit -m "feat(painel): schema do produto com countsForWholesale"
```

---

## Task 13: Server actions de produto + limite de atacado

**Files:**
- Create: `app/painel/produtos/actions.ts`
- Create: `app/painel/settings-actions.ts`

- [ ] **Step 1: Actions de produto (gravam counts_for_wholesale)**

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
    counts_for_wholesale: data.countsForWholesale, active: data.active,
  }).select('id').single()
  if (error) throw error
  const { error: vErr } = await db.from('product_variants').insert(
    data.variants.map((v) => ({ product_id: prod.id, size: v.size, color: v.color, stock: v.stock }))
  )
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
    counts_for_wholesale: data.countsForWholesale, active: data.active, updated_at: new Date().toISOString(),
  }).eq('id', id)
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

- [ ] **Step 2: Action do limite de atacado**

```ts
// app/painel/settings-actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function setWholesaleThreshold(value: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  const threshold = Math.max(1, Math.floor(Number(value) || 1))
  const db = createAdminClient()
  await db.from('store_settings').update({ wholesale_threshold: threshold, updated_at: new Date().toISOString() }).eq('id', 1)
  revalidatePath('/painel')
  revalidatePath('/')
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/painel/produtos/actions.ts app/painel/settings-actions.ts
git commit -m "feat(painel): actions de produto (counts_for_wholesale) + limite de atacado"
```

---

## Task 14: Formulário de produto (checkbox) + home com limite

**Files:**
- Create: `app/painel/produtos/_components/produto-form.tsx`
- Create: `app/painel/produtos/novo/page.tsx`, `app/painel/produtos/[id]/page.tsx`
- Create: `app/painel/page.tsx`

- [ ] **Step 1: Formulário (client) com checkbox "conta pro atacado"**

`produto-form.tsx` ('use client') com `react-hook-form` + `zodResolver(produtoSchema)`.
Base: a Task 13 (Step 1) do plano anterior, **com estas diferenças**:
- **Remover** o campo "qtd mín. atacado" (`minWholesale`).
- **Adicionar** um checkbox **"Esta peça conta pro atacado"** ligado a
  `countsForWholesale` (default `true`), usando o componente `Checkbox` do
  shadcn (`@/components/ui/checkbox`) + `Label`.
- Demais campos (código, nome, categoria, descrição, custo, atacado, varejo,
  switch ativo), upload de foto (`uploadProdutoImage`) e grade de variações
  (`useFieldArray`) seguem iguais.
- Defaults do form em modo "create": `countsForWholesale: true, active: true,
  variants: [{ size: '', color: '', stock: 0 }]`. Em "edit": preencher de
  `produto` (incluindo `countsForWholesale`).
- Submit chama `createProduto`/`updateProduto` e redireciona para `/painel/produtos`.

Trecho do checkbox (inserir entre os preços e a grade de variações):

```tsx
import { Checkbox } from '@/components/ui/checkbox'
// ...
<div className="flex items-center gap-2">
  <Checkbox
    id="countsForWholesale"
    checked={watch('countsForWholesale')}
    onCheckedChange={(v) => setValue('countsForWholesale', v === true)}
  />
  <Label htmlFor="countsForWholesale" className="text-sm">
    Esta peça conta pro atacado (desmarque para meias/brindes)
  </Label>
</div>
```

- [ ] **Step 2: Páginas novo / editar**

Executar **a Task 13 (Steps 2–3)** do plano anterior (`novo/page.tsx` e
`[id]/page.tsx`) — idênticas (passam `mode` e `produto` ao `ProdutoForm`).

- [ ] **Step 3: Home do painel com o limite de atacado**

```tsx
// app/painel/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStoreSettings } from '@/lib/data/settings'
import { setWholesaleThreshold } from './settings-actions'
import { logout } from './login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function PainelHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const settings = await getStoreSettings()

  async function salvar(formData: FormData) {
    'use server'
    await setWholesaleThreshold(Number(formData.get('threshold')))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel Karolla Fit</h1>
        <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
      </div>

      <Link href="/painel/produtos" className="inline-block underline text-[#9bbf00]">Gerenciar produtos →</Link>

      <form action={salvar} className="max-w-sm space-y-2 rounded-xl border border-border p-4">
        <Label htmlFor="threshold" className="text-sm font-medium">Peças para virar atacado</Label>
        <p className="text-xs text-muted-foreground">A partir desta quantidade de peças que contam, o carrinho do cliente vira atacado.</p>
        <div className="flex gap-2">
          <Input id="threshold" name="threshold" type="number" min={1} defaultValue={settings.wholesaleThreshold} className="w-24" />
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Verificar o fluxo completo (manual)**

1. `/painel/produtos/novo` → preencher, subir foto, marcar/desmarcar "conta pro
   atacado", adicionar 2 variações, salvar → aparece na lista e no site.
2. Editar um produto, **desmarcar** "conta pro atacado" (ex: cadastre uma "Meia")
   → no site, 1 legging + 3 meias continua **varejo**; 4 leggings vira **atacado**
   e as meias entram no preço de atacado junto.
3. Na home do painel, mudar o limite para 3, salvar → o site passa a virar
   atacado com 3 peças que contam.

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/_components/produto-form.tsx app/painel/produtos/novo app/painel/produtos/[id] app/painel/page.tsx
git commit -m "feat(painel): form com 'conta pro atacado', páginas novo/editar e limite na home"
```

---

## Task 15: Botões de ação na lista (ativar/desativar/excluir)

**Files:**
- Create: `app/painel/produtos/_components/produto-actions.tsx`
- Modify: `app/painel/produtos/page.tsx`

- [ ] **Step 1: Implementar**

Executar **a Task 14 (Steps 1, 3)** do plano anterior — `produto-actions.tsx`
('use client') com switch ativo/inativo (`setProdutoActive`) e excluir com
`AlertDialog` (`deleteProduto`), e ligá-lo na lista. (O logout já está na home,
Task 14 deste plano — não repetir.)

- [ ] **Step 2: Commit**

```bash
git add app/painel/produtos/page.tsx app/painel/produtos/_components/produto-actions.tsx
git commit -m "feat(painel): ações de ativar/desativar/excluir na lista"
```

---

## Task 16: Verificação final

- [ ] **Step 1: Testes**

Run: `pnpm test`
Expected: PASS — `mappers`, `products.helpers`, `cart.helpers`, `produto-schema`.

- [ ] **Step 2: Tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Checklist funcional (manual, com `pnpm dev`)**

- [ ] Site lista produtos do Supabase, com código e preços varejo/atacado.
- [ ] Carrinho com 3 peças que contam → varejo; com 4 → atacado (banner muda).
- [ ] Peça marcada "não conta" não ajuda a atingir o limite, mas pega o atacado quando ele é atingido.
- [ ] Mensagem do WhatsApp sai com o tipo (Atacado/Varejo) e o total corretos.
- [ ] Login protege `/painel/*`.
- [ ] Criar/editar/excluir/ativar produto reflete no site; upload de foto funciona.
- [ ] Marcar/desmarcar "conta pro atacado" reflete na regra do site.
- [ ] Mudar o limite na home do painel muda o comportamento do site.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: fase 1 + regra de atacado por carrinho concluída"
```

---

## Notas para a Fase 2 (não implementar agora)

- `orders`/`order_items`, RPCs de reserva, pg_cron, Realtime no painel de
  Pedidos, e envio do site reservando estoque antes do WhatsApp.
- Tela de **Configurações** completa (nome da loja, **número do WhatsApp**,
  minutos de reserva). O `cart.tsx` passará a usar o número configurado em vez do
  placeholder `5500000000000`. O campo de limite de atacado (hoje na home) migra
  para essa tela.
