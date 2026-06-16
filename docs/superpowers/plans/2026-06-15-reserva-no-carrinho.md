# Reserva de estoque no carrinho — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao colocar um item no carrinho, travar a peça por 30 min (reserva no banco) para que outro cliente não compre a mesma; a reserva expira sozinha e vira baixa de estoque ao finalizar.

**Architecture:** Tabela `cart_reservations` + id de carrinho anônimo no localStorage. Funções SQL atômicas (`reservar_item`, `liberar_item`, `liberar_carrinho`) concedem no máximo o disponível (`estoque − reservas de outros carrinhos`). A view pública `public_product_variants` passa a expor o estoque já descontado das reservas ativas, então a vitrine mostra menos peças/"Esgotado" automaticamente. Server actions chamam as funções; o cliente reserva ao adicionar e libera ao remover/finalizar.

**Tech Stack:** Next.js (server actions), Supabase (Postgres + RPC `security definer` + view), Zustand (carrinho), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-reserva-no-carrinho-design.md`

---

## Arquivos afetados

- Criar: `supabase/migrations/0016_reserva_carrinho.sql` — tabela, funções, view.
- Criar: `app/_actions/reserva-carrinho.ts` — server actions.
- Criar: `app/_actions/reserva-carrinho.test.ts` — testes das actions.
- Criar: `lib/data/reserva.helpers.ts` — helper puro de clamp.
- Criar: `lib/data/reserva.helpers.test.ts` — teste do helper.
- Modificar: `lib/store.ts` — `cartId` + `ensureCartId` + `variantId` no CartItem.
- Criar: `lib/store.test.ts` — teste do cartId.
- Modificar: `app/_actions/criar-pedido.ts` — param `cartId` + libera o carrinho.
- Modificar: `app/_actions/criar-pedido.test.ts` — fake rpc registra chamadas + teste.
- Modificar: `components/product-card.tsx` — reserva ao adicionar (async).
- Modificar: `components/cart.tsx` — libera ao remover/limpar, re-pede no mount, passa `cartId`.
- Modificar: `components/cart.test.tsx` — mock das actions de reserva.

---

## Task 1: Migration SQL — tabela, funções e view

**Files:**
- Create: `supabase/migrations/0016_reserva_carrinho.sql`

> Sem teste automatizado (Postgres). Validar contra o schema; aplicar manualmente
> no Supabase antes do merge.

- [ ] **Step 1: Criar o arquivo de migration**

Criar `supabase/migrations/0016_reserva_carrinho.sql` com EXATAMENTE:

```sql
-- supabase/migrations/0016_reserva_carrinho.sql
-- Reserva de estoque no carrinho: trava a peça por 30 min, expira sozinha.

create table if not exists public.cart_reservations (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index if not exists cart_reservations_variant_idx on public.cart_reservations(variant_id);
create index if not exists cart_reservations_expires_idx on public.cart_reservations(expires_at);

-- Ninguém acessa a tabela direto; tudo via funções security definer (service_role).
alter table public.cart_reservations enable row level security;

-- Reserva (ou ajusta) a quantidade de uma variação para um carrinho.
-- Retorna quanto foi efetivamente reservado (pode ser menor que o pedido).
create or replace function public.reservar_item(p_cart_id uuid, p_variant_id uuid, p_quantity int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock int;
  v_others int;
  v_grant int;
begin
  -- limpeza oportunista das reservas vencidas
  delete from public.cart_reservations where expires_at <= now();

  -- quantidade não positiva: solta a reserva desse carrinho e sai
  if p_quantity <= 0 then
    delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
    return 0;
  end if;

  -- trava a linha da variação pra serializar a corrida
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if v_stock is null then
    return 0;
  end if;

  select coalesce(sum(quantity), 0) into v_others
  from public.cart_reservations
  where variant_id = p_variant_id and cart_id <> p_cart_id and expires_at > now();

  v_grant := least(p_quantity, greatest(v_stock - v_others, 0));

  if v_grant <= 0 then
    delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
    return 0;
  end if;

  insert into public.cart_reservations (cart_id, variant_id, quantity, expires_at, updated_at)
  values (p_cart_id, p_variant_id, v_grant, now() + interval '30 minutes', now())
  on conflict (cart_id, variant_id)
  do update set quantity = excluded.quantity, expires_at = excluded.expires_at, updated_at = now();

  return v_grant;
end;
$$;
revoke all on function public.reservar_item(uuid, uuid, int) from public, anon;
grant execute on function public.reservar_item(uuid, uuid, int) to service_role;

create or replace function public.liberar_item(p_cart_id uuid, p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
end;
$$;
revoke all on function public.liberar_item(uuid, uuid) from public, anon;
grant execute on function public.liberar_item(uuid, uuid) to service_role;

create or replace function public.liberar_carrinho(p_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_reservations where cart_id = p_cart_id;
end;
$$;
revoke all on function public.liberar_carrinho(uuid) from public, anon;
grant execute on function public.liberar_carrinho(uuid) to service_role;

-- View pública de variações: estoque JÁ descontado das reservas ativas.
-- Mantém as mesmas colunas/tipos (id, product_id, size, color, available, stock)
-- pra não quebrar quem consome (create or replace view exige isso).
create or replace view public.public_product_variants
  with (security_invoker = false) as
  select pv.id, pv.product_id, pv.size, pv.color,
         ((pv.stock - coalesce(r.reserved, 0)) > 0) as available,
         greatest(pv.stock - coalesce(r.reserved, 0), 0) as stock
  from public.product_variants pv
  left join (
    select variant_id, sum(quantity) as reserved
    from public.cart_reservations
    where expires_at > now()
    group by variant_id
  ) r on r.variant_id = pv.id;

grant select on public.public_product_variants to anon;
```

- [ ] **Step 2: Validar contra o schema existente**

Ler `supabase/migrations/0001_schema_fase1.sql` (confirmar `product_variants.id`, `.stock`) e `supabase/migrations/0012_multifotos_estoque.sql` (confirmar que a view `public_product_variants` original tem as colunas na ordem `id, product_id, size, color, available, stock`). A nova definição precisa manter exatamente essas colunas/ordem/tipos. Reportar o que encontrou; só mudar o SQL se houver divergência real.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0016_reserva_carrinho.sql
git commit -m "feat: tabela e funções de reserva de estoque no carrinho"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

> **Deploy:** aplicar este SQL no painel do Supabase (colar o arquivo inteiro e Run)
> antes de mergear na main.

---

## Task 2: Server actions de reserva

**Files:**
- Create: `app/_actions/reserva-carrinho.ts`
- Test: `app/_actions/reserva-carrinho.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `app/_actions/reserva-carrinho.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reservarItem, liberarItem, liberarCarrinho } from './reserva-carrinho'

let rpcCalls: { name: string; params: any }[] = []
let rpcData: any = 0
let rpcError: any = null

function fakeDb() {
  return {
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params })
      return { data: rpcData, error: rpcError }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))

beforeEach(() => {
  rpcCalls = []
  rpcData = 0
  rpcError = null
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

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run app/_actions/reserva-carrinho.test.ts`
Expected: FALHA (módulo `./reserva-carrinho` não existe).

- [ ] **Step 3: Implementar as actions**

Criar `app/_actions/reserva-carrinho.ts`:

```ts
// app/_actions/reserva-carrinho.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'

// Reserva (ou ajusta) a quantidade de uma variação para um carrinho.
// Devolve quanto foi efetivamente reservado. Em falha de banco, devolve a
// quantidade pedida (best effort) pra não travar o cliente — o pedido final
// ainda valida o estoque.
export async function reservarItem(cartId: string, variantId: string, quantity: number): Promise<number> {
  if (!cartId || !variantId) return 0
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

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run app/_actions/reserva-carrinho.test.ts`
Expected: PASSA tudo.

- [ ] **Step 5: Commit**

```bash
git add app/_actions/reserva-carrinho.ts app/_actions/reserva-carrinho.test.ts
git commit -m "feat: server actions de reserva de carrinho"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Task 3: Helper puro de clamp

**Files:**
- Create: `lib/data/reserva.helpers.ts`
- Test: `lib/data/reserva.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/data/reserva.helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { addableFromGrant } from './reserva.helpers'

describe('addableFromGrant', () => {
  it('quanto ainda dá pra adicionar = concedido menos o que já está no carrinho', () => {
    expect(addableFromGrant(5, 2)).toBe(3)
  })
  it('nunca negativo', () => {
    expect(addableFromGrant(2, 3)).toBe(0)
  })
  it('zero concedido = nada a adicionar', () => {
    expect(addableFromGrant(0, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/data/reserva.helpers.test.ts`
Expected: FALHA (módulo não existe).

- [ ] **Step 3: Implementar**

Criar `lib/data/reserva.helpers.ts`:

```ts
// lib/data/reserva.helpers.ts

// Dado quanto o servidor concedeu de reserva para uma variação (total) e quanto
// já existe no carrinho dessa variação, devolve quanto ainda pode ser adicionado.
export function addableFromGrant(granted: number, alreadyInCart: number): number {
  return Math.max(0, granted - alreadyInCart)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run lib/data/reserva.helpers.test.ts`
Expected: PASSA.

- [ ] **Step 5: Commit**

```bash
git add lib/data/reserva.helpers.ts lib/data/reserva.helpers.test.ts
git commit -m "feat: helper addableFromGrant para clamp de reserva"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Task 4: `cartId` e `variantId` no store

**Files:**
- Modify: `lib/store.ts`
- Test: `lib/store.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `lib/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from './store'

beforeEach(() => {
  useCartStore.setState({ items: [], cartId: '' })
})

describe('cartId', () => {
  it('ensureCartId gera um id na primeira vez e mantém nas seguintes', () => {
    const id1 = useCartStore.getState().ensureCartId()
    expect(id1).toBeTruthy()
    const id2 = useCartStore.getState().ensureCartId()
    expect(id2).toBe(id1)
    expect(useCartStore.getState().cartId).toBe(id1)
  })
})

describe('addItem guarda o variantId', () => {
  it('preserva o variantId passado', () => {
    const product: any = {
      id: 'L', code: 'LEG', name: 'Legging', category: '', description: '', imageUrl: null, imageUrls: [],
      priceCost: 0, priceWholesale: 50, priceRetail: 90, weightGrams: 250, countsForWholesale: true,
      onPromo: false, promoPrice: 0, active: true, sortOrder: 0,
    }
    useCartStore.getState().addItem({ product, quantity: 1, size: 'M', color: 'Preto', variantId: 'var-1', maxStock: 5 })
    expect(useCartStore.getState().items[0].variantId).toBe('var-1')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run lib/store.test.ts`
Expected: FALHA (`ensureCartId` não existe; `variantId` não no tipo).

- [ ] **Step 3: Implementar**

Em `lib/store.ts`, adicionar `variantId` ao `CartItem`:

```ts
export interface CartItem {
  product: Product
  quantity: number
  size: string
  color: string
  variantId?: string
  maxStock?: number
}
```

Adicionar `cartId` e `ensureCartId` ao tipo `CartStore` (logo após `items`):

```ts
interface CartStore {
  items: CartItem[]
  cartId: string
  ensureCartId: () => string
  addItem: (item: CartItem) => void
  removeItem: (productId: string, size: string, color: string) => void
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
}
```

E no corpo do store (logo após `items: [],`):

```ts
      cartId: '',
      ensureCartId: () => {
        let id = get().cartId
        if (!id) {
          id = crypto.randomUUID()
          set({ cartId: id })
        }
        return id
      },
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run lib/store.test.ts`
Expected: PASSA.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts
git commit -m "feat: cartId anônimo e variantId no carrinho"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Task 5: `criarPedido` libera o carrinho ao finalizar

**Files:**
- Modify: `app/_actions/criar-pedido.ts`
- Test: `app/_actions/criar-pedido.test.ts`

- [ ] **Step 1: Atualizar o fake DB e adicionar o teste que falha**

Em `app/_actions/criar-pedido.test.ts`:

(a) Adicionar estado para registrar chamadas de rpc, junto das outras vars do topo:

```ts
let rpcCalls: { name: string; params: any }[] = []
```

(b) Trocar o método `rpc` do fake DB (hoje `async rpc(_name, _params) { return { error: rpcError } }`) por:

```ts
    async rpc(name: string, params: any) {
      rpcCalls.push({ name, params })
      return { error: rpcError }
    },
```

(c) No `beforeEach`, resetar:

```ts
  rpcCalls = []
```

(d) Adicionar teste dentro do `describe('criarPedido', ...)`:

```ts
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
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: FALHA nos dois novos testes (hoje só `reserve_order` é chamado e não existe `cartId`).

- [ ] **Step 3: Implementar**

Em `app/_actions/criar-pedido.ts`, adicionar `cartId` ao input:

```ts
export interface CriarPedidoInput {
  customerName: string
  customerPhone: string
  items: RequestedItem[]
  shippingMethodId?: string | null
  paymentMethodId?: string | null
  cartId?: string | null
}
```

E, logo depois do bloco que chama `reserve_order` (após o `if (rErr) { ... }` e antes do `return { ok: true, ... }`), inserir:

```ts
  // Já baixamos o estoque de verdade; solta as reservas de carrinho desse cliente
  // pra não descontar duas vezes. Falha aqui não derruba o pedido (a reserva
  // expira sozinha em 30 min).
  if (input.cartId) {
    const { error: lErr } = await db.rpc('liberar_carrinho', { p_cart_id: input.cartId })
    if (lErr) console.error('[criarPedido] falha ao liberar carrinho:', lErr)
  }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: PASSA tudo (os testes antigos seguem verdes — `rpcCalls` só registra, o retorno do rpc segue `{ error: rpcError }`).

- [ ] **Step 5: Commit**

```bash
git add app/_actions/criar-pedido.ts app/_actions/criar-pedido.test.ts
git commit -m "feat: criarPedido libera reservas do carrinho ao finalizar"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Task 6: Reservar ao adicionar no `ProductCard`

**Files:**
- Modify: `components/product-card.tsx`

> Sem teste unitário (componente com framer-motion, sem suíte própria).
> Verificação manual na Task 8.

- [ ] **Step 1: Implementar a reserva ao adicionar**

Em `components/product-card.tsx`:

(a) Adicionar os imports (junto dos outros no topo):

```tsx
import { reservarItem } from '@/app/_actions/reserva-carrinho'
import { addableFromGrant } from '@/lib/data/reserva.helpers'
```

(b) Adicionar um estado de aviso, junto dos outros `useState` do componente:

```tsx
  const [aviso, setAviso] = useState<string | null>(null)
```

(c) Substituir a função `handleAddToCart` atual:

```tsx
  const handleAddToCart = () => {
    if (!available) return
    addItem({ product, quantity, size: selectedSize, color: selectedColor, maxStock: stock })
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1500)
  }
```

por:

```tsx
  const handleAddToCart = async () => {
    if (!available) return
    setAviso(null)
    const variant = product.variants.find((v) => v.size === selectedSize && v.color === selectedColor)
    const store = useCartStore.getState()
    const cartId = store.ensureCartId()
    const jaNoCarrinho = store.items.find(
      (i) => i.product.id === product.id && i.size === selectedSize && i.color === selectedColor
    )?.quantity ?? 0
    const desejado = jaNoCarrinho + quantity

    // Reserva no servidor. Sem variant (catálogo antigo) não dá pra reservar:
    // segue o fluxo antigo e o pedido final cobre o estoque.
    const granted = variant ? await reservarItem(cartId, variant.id, desejado) : desejado
    const podeAdicionar = addableFromGrant(granted, jaNoCarrinho)
    if (podeAdicionar <= 0) {
      setAviso('Essa peça acabou de ser reservada. Tente outra cor/tamanho.')
      return
    }

    addItem({ product, quantity: podeAdicionar, size: selectedSize, color: selectedColor, variantId: variant?.id, maxStock: stock })
    if (granted < desejado) setAviso(`Só sobraram ${granted} no estoque.`)
    setIsAdded(true)
    setTimeout(() => setIsAdded(false), 1500)
  }
```

(d) Mostrar o aviso logo abaixo do botão "Adicionar ao Carrinho". Localizar o fechamento do `<motion.div whileTap={{ scale: 0.98 }}>` que envolve o `<Button>` (a tag `</motion.div>` logo antes do `</div>` que fecha o bloco `p-3 md:p-4`). Inserir, imediatamente após esse `</motion.div>`:

```tsx
        {aviso && <p className="text-xs text-amber-500 mt-2">{aviso}</p>}
```

- [ ] **Step 2: Confirmar que compila e os testes seguem verdes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: testes PASSAM, `tsc` sem erros.

- [ ] **Step 3: Commit**

```bash
git add components/product-card.tsx
git commit -m "feat: reserva a peça no servidor ao adicionar ao carrinho"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Task 7: Liberar/renovar reservas no `Cart`

**Files:**
- Modify: `components/cart.tsx`
- Modify: `components/cart.test.tsx`

- [ ] **Step 1: Mockar as actions de reserva no teste existente**

Em `components/cart.test.tsx`, adicionar logo após o mock de `criar-pedido` (linha 8-10):

```tsx
vi.mock('@/app/_actions/reserva-carrinho', () => ({
  reservarItem: vi.fn(async () => 99),
  liberarItem: vi.fn(async () => {}),
  liberarCarrinho: vi.fn(async () => {}),
}))
```

- [ ] **Step 2: Rodar a suíte do cart e confirmar que segue passando**

Run: `npx vitest run components/cart.test.tsx`
Expected: PASSA (o mock evita chamadas reais; o comportamento de envio não muda ainda).

- [ ] **Step 3: Implementar liberar/renovar no Cart**

Em `components/cart.tsx`:

(a) Adicionar imports (junto dos outros do topo):

```tsx
import { useEffect } from 'react'
import { reservarItem, liberarItem, liberarCarrinho } from '@/app/_actions/reserva-carrinho'
import { addableFromGrant } from '@/lib/data/reserva.helpers'
```

(Se já houver `import { useState } from 'react'`, troque para `import { useState, useEffect } from 'react'` e não duplique.)

(b) Pegar `ensureCartId` e `addItem` do store. Localizar:

```tsx
  const { items, removeItem, updateQuantity, clearCart, getTotalItems } = useCartStore()
```

e trocar por:

```tsx
  const { items, removeItem, updateQuantity, clearCart, getTotalItems, ensureCartId } = useCartStore()
```

(c) Re-pedir as reservas ao montar (renova os 30 min; ajusta o que não está mais
disponível). Inserir logo após a linha do `const totalItems = getTotalItems()`:

```tsx
  // Ao abrir a página com carrinho salvo, renova as reservas e ajusta o que
  // não está mais disponível. Roda uma vez no mount.
  useEffect(() => {
    const cartId = ensureCartId()
    useCartStore.getState().items.forEach(async (i) => {
      if (!i.variantId) return
      const granted = await reservarItem(cartId, i.variantId, i.quantity)
      if (granted < i.quantity) updateQuantity(i.product.id, i.size, i.color, granted)
      if (granted <= 0) removeItem(i.product.id, i.size, i.color)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

(d) Criar handlers que envolvem remover/alterar quantidade liberando/reservando no
servidor. Inserir logo após o `useEffect` acima:

```tsx
  const handleRemove = (item: CartItem) => {
    const cartId = ensureCartId()
    removeItem(item.product.id, item.size, item.color)
    if (item.variantId) liberarItem(cartId, item.variantId)
  }

  const handleUpdateQuantity = async (item: CartItem, novaQtd: number) => {
    const cartId = ensureCartId()
    if (!item.variantId) {
      updateQuantity(item.product.id, item.size, item.color, novaQtd)
      return
    }
    const granted = await reservarItem(cartId, item.variantId, novaQtd)
    const aplicar = Math.max(0, granted)
    updateQuantity(item.product.id, item.size, item.color, Math.min(novaQtd, aplicar))
  }

  const handleClearCart = () => {
    const cartId = ensureCartId()
    clearCart()
    liberarCarrinho(cartId)
  }
```

(e) Usar os novos handlers nos `CartItemCard`. Localizar:

```tsx
                            <CartItemCard
                              key={`${item.product.id}-${item.size}-${item.color}`}
                              item={item}
                              index={index}
                              priceType={priceType}
                              onRemove={() => removeItem(item.product.id, item.size, item.color)}
                              onUpdateQuantity={(qty) => updateQuantity(item.product.id, item.size, item.color, qty)}
                            />
```

e trocar por:

```tsx
                            <CartItemCard
                              key={`${item.product.id}-${item.size}-${item.color}`}
                              item={item}
                              index={index}
                              priceType={priceType}
                              onRemove={() => handleRemove(item)}
                              onUpdateQuantity={(qty) => handleUpdateQuantity(item, qty)}
                            />
```

(f) Trocar os dois usos de `clearCart` diretos. No botão "Limpar carrinho":

```tsx
                        <button onClick={clearCart} className="w-full text-xs md:text-sm text-muted-foreground hover:text-destructive transition-colors">Limpar carrinho</button>
```

vira:

```tsx
                        <button onClick={handleClearCart} className="w-full text-xs md:text-sm text-muted-foreground hover:text-destructive transition-colors">Limpar carrinho</button>
```

(O `clearCart()` dentro do `setTimeout` do `handleSendOrder` permanece — ali o
carrinho é liberado pelo `criarPedido` via `liberar_carrinho`, então só limpa o
estado local.)

(g) Passar o `cartId` ao finalizar. Em `handleSendOrder`, na chamada `criarPedido({...})`,
adicionar o campo `cartId`:

```tsx
      const r = await criarPedido({
        customerName,
        customerPhone,
        items: items.map((i) => ({ productId: i.product.id, size: i.size, color: i.color, quantity: i.quantity })),
        shippingMethodId: shippingId || null,
        paymentMethodId: paymentId || null,
        cartId: ensureCartId(),
      })
```

- [ ] **Step 4: Rodar a suíte inteira e o type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tudo PASSA, `tsc` limpo. (`CartItem` já é importado em cart.tsx na linha 6.)

- [ ] **Step 5: Commit**

```bash
git add components/cart.tsx components/cart.test.tsx
git commit -m "feat: carrinho libera/renova reservas e envia cartId no pedido"
```

Trailer (linha em branco antes):
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

---

## Task 8: Verificação manual (após aplicar a migration no Supabase)

> Pré-requisito: aplicar `0016_reserva_carrinho.sql` no painel do Supabase.

- [ ] **Trava entre clientes:** com um produto de estoque 1, abrir o catálogo em dois
  navegadores (ou um normal + um anônimo). Adicionar a peça no navegador A. No
  navegador B, recarregar e confirmar que a peça aparece como "Esgotado".
- [ ] **Libera ao remover:** remover a peça do carrinho no navegador A; recarregar o
  B e confirmar que voltou a ficar disponível.
- [ ] **Expiração:** adicionar uma peça, esperar 30 min sem mexer, recarregar o outro
  navegador e confirmar que a peça voltou ao estoque.
- [ ] **Finalizar:** adicionar e finalizar o pedido; confirmar no painel que o pedido
  entrou e que o estoque baixou; a reserva do carrinho deve ter sumido (não desconta
  duas vezes — conferir o número de estoque do produto).
- [ ] **Só sobraram X:** com estoque 2, tentar adicionar 5; confirmar o aviso de que
  só sobraram 2 e que o carrinho ficou com 2.

---

## Self-review

- **Cobertura do spec:** tabela + funções + view (Task 1); server actions (Task 2);
  helper de clamp (Task 3); cartId + variantId (Task 4); liberar ao finalizar
  (Task 5); reservar ao adicionar (Task 6); liberar/renovar no carrinho + passar
  cartId (Task 7); verificação manual incl. corrida, expiração e "só sobraram X"
  (Task 8). ✓
- **Sem placeholders:** todos os passos têm código/SQL/comandos concretos. ✓
- **Consistência de nomes:** RPCs `reservar_item`/`liberar_item`/`liberar_carrinho`
  e params `p_cart_id`/`p_variant_id`/`p_quantity` batem entre SQL (Task 1), actions
  (Task 2) e criarPedido (Task 5). `ensureCartId`, `addableFromGrant`, `variantId`,
  `cartId` usados de forma consistente entre store (Task 4), product-card (Task 6) e
  cart (Task 7). ✓
- **Nota de risco:** Task 6 e 7 não têm teste unitário (UI); cobertas por
  verificação manual na Task 8 e pelo type-check. A suíte existente do cart é
  protegida pelo mock das actions (Task 7, Step 1).
