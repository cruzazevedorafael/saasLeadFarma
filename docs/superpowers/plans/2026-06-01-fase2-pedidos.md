# Fase 2 — Pedidos, baixa de estoque e financeiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar pedidos no painel, dar baixa no estoque (atômico), configurar o WhatsApp da loja e mostrar um resumo financeiro do mês — fechando o laço do menu.

**Architecture:** O envio do menu passa a chamar uma **server action** que recalcula o preço no servidor (reusando os helpers de preço da Fase 1) e grava `orders` + `order_items`. A **baixa** é uma função Postgres atômica que valida e desconta estoque. O painel ganha telas de **Pedidos** e **Financeiro**. Modelo **manual, sem reserva/cronômetro**.

**Tech Stack:** Next.js 16 (App Router) · Supabase (Postgres/Auth) · Vitest · shadcn/ui + Tailwind · recharts (gráfico).

**Spec:** [docs/superpowers/specs/2026-06-01-fase2-pedidos-design.md](../specs/2026-06-01-fase2-pedidos-design.md)

---

## Estrutura de arquivos

```
supabase/migrations/0004_pedidos.sql        # CRIAR: orders, order_items, sequence, complete_order(), RLS
lib/data/orders.types.ts                     # CRIAR: tipos Order/OrderItem/OrderWithItems
lib/data/order.helpers.ts (+test)            # CRIAR: buildOrder() puro (reusa cart.helpers)
lib/data/orders.ts                           # CRIAR: getAdminOrders/getOrderWithItems + mapper
lib/data/finance.ts (+test)                  # CRIAR: summarize() puro + getMonthlySummary
app/_actions/criar-pedido.ts                 # CRIAR: server action pública (salva o pedido)
app/painel/pedidos/actions.ts                # CRIAR: darBaixa/cancelarPedido
app/painel/pedidos/page.tsx                  # CRIAR: lista de pedidos
app/painel/pedidos/_components/pedido-actions.tsx  # CRIAR: botões baixa/cancelar (client)
app/painel/financeiro/page.tsx               # CRIAR: resumo do mês
app/painel/financeiro/_components/vendas-chart.tsx # CRIAR: gráfico (client, recharts)
app/painel/settings-actions.ts               # MODIFICAR: + setStoreContact
app/painel/page.tsx                          # MODIFICAR: + campo WhatsApp/nome + links
components/cart.tsx                           # MODIFICAR: chama criarPedido + usa whatsappNumber
app/_components/catalog.tsx                   # MODIFICAR: passa whatsappNumber ao Cart
app/page.tsx                                  # MODIFICAR: passa whatsappNumber ao Catalog
```

---

## Task 0: Rodar a migration 0004 no Supabase (manual)

> ⚠️ **Manual** (Wesllei). Feito UMA vez no SQL Editor. Pode ser feito após a Task 1
> criar o arquivo (o conteúdo é o mesmo). Sem isso, as telas de pedido dão erro.

- [ ] **Step 1:** Abrir Supabase → **SQL Editor** → colar o conteúdo de
  `supabase/migrations/0004_pedidos.sql` (ver Task 1) → **Run** → "Success".
- [ ] **Step 2:** Conferir: `select * from public.orders;` retorna vazio (tabela existe);
  `select public.complete_order('00000000-0000-0000-0000-000000000000');` deve dar
  erro "Pedido não encontrado" (função existe).

---

## Task 1: Migration 0004 (orders, order_items, complete_order)

**Files:** Create `supabase/migrations/0004_pedidos.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0004_pedidos.sql

-- número sequencial humano do pedido (#1000, #1001, ...)
create sequence if not exists public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.order_number_seq'),
  customer_name text not null default '',
  customer_phone text not null default '',
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  price_type text not null default 'retail' check (price_type in ('retail','wholesale')),
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  product_code text not null default '',
  product_name text not null default '',
  size text not null default '',
  color text not null default '',
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0
);
create index on public.order_items(order_id);

-- RLS: só o admin (authenticated) acessa
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create policy "admin all orders" on public.orders for all to authenticated using (true) with check (true);
create policy "admin all order_items" on public.order_items for all to authenticated using (true) with check (true);

-- BAIXA atômica: valida estoque e desconta numa transação
create or replace function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_missing text;
  r record;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;

  select string_agg(oi.product_code || ' (' || oi.size || '/' || oi.color || ')', ', ')
    into v_missing
  from public.order_items oi
  join public.product_variants pv on pv.id = oi.variant_id
  where oi.order_id = p_order_id and pv.stock < oi.quantity;

  if v_missing is not null then
    raise exception 'Estoque insuficiente para: %', v_missing;
  end if;

  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock - r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;

  update public.orders set status='completed', completed_at=now() where id=p_order_id;
end;
$$;

revoke all on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_pedidos.sql
git commit -m "feat(db): pedidos (orders, order_items, complete_order atômica)"
```

> Rodar no Supabase é a **Task 0** (manual).

---

## Task 2: Tipos de pedido

**Files:** Create `lib/data/orders.types.ts`

- [ ] **Step 1: Escrever os tipos**

```ts
// lib/data/orders.types.ts
export type OrderStatus = 'pending' | 'completed' | 'cancelled'
export type OrderPriceType = 'retail' | 'wholesale'

export interface OrderItem {
  id: string
  productId: string | null
  variantId: string | null
  productCode: string
  productName: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export interface OrderWithItems {
  id: string
  number: number
  customerName: string
  customerPhone: string
  status: OrderStatus
  priceType: OrderPriceType
  total: number
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/data/orders.types.ts
git commit -m "feat(data): tipos de pedido"
```

---

## Task 3: Montagem do pedido (puro, TDD)

**Files:** Create `lib/data/order.helpers.ts`, Test `lib/data/order.helpers.test.ts`

> Reusa os helpers de preço já testados (`cart.helpers.ts`) — a regra de atacado
> fica num lugar só.

- [ ] **Step 1: Escrever o teste (deve falhar)**

```ts
// lib/data/order.helpers.test.ts
import { describe, it, expect } from 'vitest'
import { buildOrder } from './order.helpers'
import type { ProductWithVariants } from './types'

function prod(over: Partial<ProductWithVariants>): ProductWithVariants {
  return {
    id: 'p', code: 'C', name: 'X', category: '', description: '', imageUrl: null,
    priceCost: 0, priceWholesale: 50, priceRetail: 90, countsForWholesale: true,
    active: true, sortOrder: 0, variants: [], ...over,
  }
}

const legging = prod({
  id: 'L', code: 'LEG-001', name: 'Legging', priceWholesale: 50, priceRetail: 90, priceCost: 20,
  countsForWholesale: true,
  variants: [{ id: 'v1', productId: 'L', size: 'M', color: 'Preto', stock: 5 }],
})
const meia = prod({
  id: 'S', code: 'MEIA-001', name: 'Meia', priceWholesale: 8, priceRetail: 12, priceCost: 3,
  countsForWholesale: false,
  variants: [{ id: 'v2', productId: 'S', size: 'U', color: 'Branco', stock: 9 }],
})

describe('buildOrder', () => {
  it('varejo abaixo do limite; snapshots corretos', () => {
    const r = buildOrder([legging], [{ productId: 'L', size: 'M', color: 'Preto', quantity: 2 }], 4)
    expect(r.priceType).toBe('retail')
    expect(r.total).toBe(180) // 2 * 90
    expect(r.items[0]).toMatchObject({
      product_id: 'L', variant_id: 'v1', product_code: 'LEG-001', size: 'M', color: 'Preto',
      quantity: 2, unit_price: 90, unit_cost: 20,
    })
  })

  it('atingiu o atacado: meia (não conta) também sai no atacado', () => {
    const r = buildOrder(
      [legging, meia],
      [{ productId: 'L', size: 'M', color: 'Preto', quantity: 4 }, { productId: 'S', size: 'U', color: 'Branco', quantity: 2 }],
      4,
    )
    expect(r.priceType).toBe('wholesale')
    expect(r.total).toBe(4 * 50 + 2 * 8) // 216
    const meiaItem = r.items.find((i) => i.product_code === 'MEIA-001')!
    expect(meiaItem.unit_price).toBe(8) // atacado
    expect(meiaItem.unit_cost).toBe(3)
  })

  it('variant_id null quando a combinação não existe', () => {
    const r = buildOrder([legging], [{ productId: 'L', size: 'GG', color: 'Rosa', quantity: 1 }], 4)
    expect(r.items[0].variant_id).toBeNull()
  })

  it('erro quando o produto não existe', () => {
    expect(() => buildOrder([], [{ productId: 'X', size: 'M', color: 'Preto', quantity: 1 }], 4)).toThrow()
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test order.helpers`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar**

```ts
// lib/data/order.helpers.ts
import { cartPriceType, unitPriceFor, cartTotal, type PriceType } from './cart.helpers'
import type { ProductWithVariants } from './types'
import type { CartItem } from '@/lib/store'

export interface RequestedItem {
  productId: string
  size: string
  color: string
  quantity: number
}

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
}

export interface BuiltOrder {
  priceType: PriceType
  total: number
  items: OrderItemRow[]
}

export function buildOrder(
  products: ProductWithVariants[],
  requested: RequestedItem[],
  threshold: number,
): BuiltOrder {
  const byId = new Map(products.map((p) => [p.id, p]))
  const cartItems: CartItem[] = requested.map((r) => {
    const p = byId.get(r.productId)
    if (!p) throw new Error(`Produto não encontrado: ${r.productId}`)
    return { product: p, quantity: r.quantity, size: r.size, color: r.color }
  })

  const priceType = cartPriceType(cartItems, threshold)
  const total = cartTotal(cartItems, priceType)

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
    }
  })

  return { priceType, total, items }
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test order.helpers`
Expected: PASS (4 casos).

- [ ] **Step 5: Commit**

```bash
git add lib/data/order.helpers.ts lib/data/order.helpers.test.ts
git commit -m "feat(data): buildOrder (monta pedido reusando a regra de atacado)"
```

---

## Task 4: Server action de criar pedido (público)

**Files:** Create `app/_actions/criar-pedido.ts`

- [ ] **Step 1: Implementar**

```ts
// app/_actions/criar-pedido.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStoreSettings } from '@/lib/data/settings'
import { mapProductRow, mapVariantRow } from '@/lib/data/mappers'
import { buildOrder, type RequestedItem } from '@/lib/data/order.helpers'
import type { ProductWithVariants } from '@/lib/data/types'

export interface CriarPedidoInput {
  customerName: string
  customerPhone: string
  items: RequestedItem[]
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

  const settings = await getStoreSettings()
  const built = buildOrder(products, input.items, settings.wholesaleThreshold)

  const { data: order, error: oErr } = await db
    .from('orders')
    .insert({
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      status: 'pending',
      price_type: built.priceType,
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

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/_actions/criar-pedido.ts
git commit -m "feat(site): server action criarPedido (recalcula preço no servidor)"
```

---

## Task 5: Camada de leitura de pedidos

**Files:** Create `lib/data/orders.ts`

- [ ] **Step 1: Implementar**

```ts
// lib/data/orders.ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { OrderWithItems, OrderStatus, OrderItem } from './orders.types'

function mapItem(r: any): OrderItem {
  return {
    id: r.id,
    productId: r.product_id ?? null,
    variantId: r.variant_id ?? null,
    productCode: r.product_code ?? '',
    productName: r.product_name ?? '',
    size: r.size ?? '',
    color: r.color ?? '',
    quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unit_price ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
  }
}

function mapOrder(r: any): OrderWithItems {
  return {
    id: r.id,
    number: Number(r.number),
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    status: r.status,
    priceType: r.price_type,
    total: Number(r.total ?? 0),
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
    cancelledAt: r.cancelled_at ?? null,
    items: (r.order_items ?? []).map(mapItem),
  }
}

export async function getAdminOrders(status?: OrderStatus): Promise<OrderWithItems[]> {
  const db = createAdminClient()
  let q = db.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapOrder)
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/data/orders.ts
git commit -m "feat(data): leitura de pedidos (admin) com itens"
```

---

## Task 6: Server actions de baixa/cancelar

**Files:** Create `app/painel/pedidos/actions.ts`

- [ ] **Step 1: Implementar**

```ts
// app/painel/pedidos/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
}

export async function darBaixa(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db.rpc('complete_order', { p_order_id: orderId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  revalidatePath('/painel/financeiro')
  revalidatePath('/')
  return { ok: true }
}

export async function cancelarPedido(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const db = createAdminClient()
  const { error } = await db
    .from('orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', orderId)
    .neq('status', 'completed')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  return { ok: true }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/painel/pedidos/actions.ts
git commit -m "feat(painel): ações de dar baixa (RPC) e cancelar pedido"
```

---

## Task 7: Tela de Pedidos

**Files:** Create `app/painel/pedidos/_components/pedido-actions.tsx`, `app/painel/pedidos/page.tsx`

- [ ] **Step 1: Componente de ações (client)**

```tsx
// app/painel/pedidos/_components/pedido-actions.tsx
'use client'

import { useState, useTransition } from 'react'
import { darBaixa, cancelarPedido } from '../actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

export function PedidoActions({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const baixa = () =>
    startTransition(async () => {
      setErro(null)
      const r = await darBaixa(orderId)
      if (!r.ok) setErro(r.error ?? 'Erro ao dar baixa')
    })

  const cancelar = () =>
    startTransition(async () => {
      setErro(null)
      const r = await cancelarPedido(orderId)
      if (!r.ok) setErro(r.error ?? 'Erro ao cancelar')
    })

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" onClick={baixa} disabled={pending} className="bg-[#CFFF04] text-black hover:bg-[#b8e600]">
          Dar baixa
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>Cancelar</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
              <AlertDialogDescription>O pedido fica marcado como cancelado. Não mexe no estoque.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={cancelar}>Cancelar pedido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Página de pedidos**

```tsx
// app/painel/pedidos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminOrders } from '@/lib/data/orders'
import type { OrderStatus } from '@/lib/data/orders.types'
import { PedidoActions } from './_components/pedido-actions'

const FILTROS: { key: string; label: string; status?: OrderStatus }[] = [
  { key: 'pending', label: 'Pendentes', status: 'pending' },
  { key: 'completed', label: 'Baixados', status: 'completed' },
  { key: 'cancelled', label: 'Cancelados', status: 'cancelled' },
  { key: 'all', label: 'Todos' },
]

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { f = 'pending' } = await searchParams
  const filtro = FILTROS.find((x) => x.key === f) ?? FILTROS[0]
  const pedidos = await getAdminOrders(filtro.status)

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
          <h1 className="text-2xl font-bold">Pedidos</h1>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((x) => (
          <Link
            key={x.key}
            href={`/painel/pedidos?f=${x.key}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              x.key === filtro.key ? 'bg-[#CFFF04] text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido nesta lista.</p>
      ) : (
        <div className="space-y-3">
          {pedidos.map((o) => (
            <div key={o.id} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{o.number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      o.priceType === 'wholesale' ? 'bg-[#CFFF04]/20 text-[#9bbf00]' : 'bg-muted text-muted-foreground'
                    }`}>{o.priceType === 'wholesale' ? 'Atacado' : 'Varejo'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      o.status === 'pending' ? 'bg-amber-500/15 text-amber-500'
                      : o.status === 'completed' ? 'bg-green-500/15 text-green-600'
                      : 'bg-red-500/15 text-red-500'
                    }`}>{o.status === 'pending' ? 'Pendente' : o.status === 'completed' ? 'Baixado' : 'Cancelado'}</span>
                  </div>
                  <p className="text-sm mt-1">{o.customerName || 'Sem nome'}</p>
                  <a
                    href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm text-[#25D366] hover:underline"
                  >{o.customerPhone || 'sem telefone'}</a>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#9bbf00]">{fmt(o.total)}</p>
                  {o.status === 'pending' && <PedidoActions orderId={o.id} />}
                </div>
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                {o.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{it.quantity}x {it.productName} ({it.productCode}) — {it.size}/{it.color}</span>
                    <span>{fmt(it.unitPrice * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/painel/pedidos/page.tsx app/painel/pedidos/_components/pedido-actions.tsx
git commit -m "feat(painel): tela de pedidos (lista, filtros, baixa/cancelar)"
```

---

## Task 8: Financeiro — agregação (TDD) + leitura

**Files:** Create `lib/data/finance.ts`, Test `lib/data/finance.test.ts`

- [ ] **Step 1: Escrever o teste (deve falhar)**

```ts
// lib/data/finance.test.ts
import { describe, it, expect } from 'vitest'
import { summarize } from './finance'

const o = (day: number, items: [number, number, number][]) => ({
  completedAt: `2026-06-${String(day).padStart(2, '0')}T12:00:00Z`,
  items: items.map(([unitPrice, unitCost, quantity]) => ({ unitPrice, unitCost, quantity })),
})

describe('summarize', () => {
  it('soma receita, custo e lucro', () => {
    const r = summarize([o(3, [[90, 20, 2]]), o(10, [[50, 20, 4], [8, 3, 2]])])
    expect(r.revenue).toBe(2 * 90 + 4 * 50 + 2 * 8) // 396
    expect(r.cost).toBe(2 * 20 + 4 * 20 + 2 * 3) // 126
    expect(r.profit).toBe(396 - 126) // 270
  })

  it('mês vazio = tudo zero', () => {
    const r = summarize([])
    expect(r).toEqual({ revenue: 0, cost: 0, profit: 0, byDay: [] })
  })

  it('sem custo, lucro = vendas', () => {
    const r = summarize([o(5, [[90, 0, 1]])])
    expect(r.revenue).toBe(90)
    expect(r.profit).toBe(90)
  })

  it('agrupa vendas por dia', () => {
    const r = summarize([o(3, [[90, 20, 1]]), o(3, [[50, 20, 2]]), o(10, [[12, 3, 1]])])
    expect(r.byDay).toEqual([
      { day: 3, revenue: 90 + 100 },
      { day: 10, revenue: 12 },
    ])
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `pnpm test finance`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar**

```ts
// lib/data/finance.ts
import { createAdminClient } from '@/lib/supabase/admin'

interface SummItem { unitPrice: number; unitCost: number; quantity: number }
interface SummOrder { completedAt: string; items: SummItem[] }

export interface MonthlySummary {
  revenue: number
  cost: number
  profit: number
  byDay: { day: number; revenue: number }[]
}

export function summarize(orders: SummOrder[]): MonthlySummary {
  let revenue = 0
  let cost = 0
  const days = new Map<number, number>()
  for (const o of orders) {
    const day = new Date(o.completedAt).getUTCDate()
    for (const it of o.items) {
      const r = it.unitPrice * it.quantity
      revenue += r
      cost += it.unitCost * it.quantity
      days.set(day, (days.get(day) ?? 0) + r)
    }
  }
  const byDay = [...days.entries()].sort((a, b) => a[0] - b[0]).map(([day, revenue]) => ({ day, revenue }))
  return { revenue, cost, profit: revenue - cost, byDay }
}

// year/month (month 1-12). Lê pedidos baixados no mês e resume.
export async function getMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const db = createAdminClient()
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, month, 1)).toISOString()
  const { data, error } = await db
    .from('orders')
    .select('completed_at, order_items(unit_price, unit_cost, quantity)')
    .eq('status', 'completed')
    .gte('completed_at', start)
    .lt('completed_at', end)
  if (error) throw error
  const orders: SummOrder[] = (data ?? []).map((o: any) => ({
    completedAt: o.completed_at,
    items: (o.order_items ?? []).map((i: any) => ({
      unitPrice: Number(i.unit_price ?? 0),
      unitCost: Number(i.unit_cost ?? 0),
      quantity: Number(i.quantity ?? 0),
    })),
  }))
  return summarize(orders)
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `pnpm test finance`
Expected: PASS (4 casos).

- [ ] **Step 5: Commit**

```bash
git add lib/data/finance.ts lib/data/finance.test.ts
git commit -m "feat(data): resumo financeiro do mês (vendas/custo/lucro) com testes"
```

---

## Task 9: Tela Financeiro (com gráfico)

**Files:** Create `app/painel/financeiro/_components/vendas-chart.tsx`, `app/painel/financeiro/page.tsx`

- [ ] **Step 1: Gráfico (client, recharts)**

```tsx
// app/painel/financeiro/_components/vendas-chart.tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function VendasChart({ data }: { data: { day: number; revenue: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Sem vendas baixadas neste mês.</p>
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" tickFormatter={(d) => `${d}`} fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`} labelFormatter={(d) => `Dia ${d}`} />
          <Bar dataKey="revenue" fill="#CFFF04" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Página**

```tsx
// app/painel/financeiro/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMonthlySummary } from '@/lib/data/finance'
import { VendasChart } from './_components/vendas-chart'

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const sp = await searchParams
  const now = new Date()
  const year = Number(sp.y) || now.getUTCFullYear()
  const month = Number(sp.m) || now.getUTCMonth() + 1 // 1-12

  const sum = await getMonthlySummary(year, month)

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Financeiro</h1>
      </div>

      <div className="flex items-center gap-4">
        <Link href={`/painel/financeiro?y=${prev.y}&m=${prev.m}`} className="px-3 py-1 rounded bg-muted hover:bg-muted/80 text-sm">←</Link>
        <span className="font-medium">{MESES[month - 1]} / {year}</span>
        <Link href={`/painel/financeiro?y=${next.y}&m=${next.m}`} className="px-3 py-1 rounded bg-muted hover:bg-muted/80 text-sm">→</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Vendas</p>
          <p className="text-2xl font-bold">{fmt(sum.revenue)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Custo</p>
          <p className="text-2xl font-bold">{fmt(sum.cost)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Lucro</p>
          <p className="text-2xl font-bold text-[#9bbf00]">{fmt(sum.profit)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O lucro depende do <strong>custo</strong> preenchido no cadastro de cada produto.
      </p>

      <VendasChart data={sum.byDay} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/painel/financeiro
git commit -m "feat(painel): tela financeiro (vendas/custo/lucro do mês + gráfico)"
```

---

## Task 10: Configurações de contato (WhatsApp/nome) + home do painel

**Files:** Modify `app/painel/settings-actions.ts`, `app/painel/page.tsx`

- [ ] **Step 1: Adicionar `setStoreContact` em `settings-actions.ts`**

Acrescentar ao final de `app/painel/settings-actions.ts`:

```ts
export async function setStoreContact(storeName: string, whatsappNumber: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  const db = createAdminClient()
  const { error } = await db
    .from('store_settings')
    .update({ store_name: storeName, whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
  revalidatePath('/painel')
  revalidatePath('/')
}
```

- [ ] **Step 2: Reescrever `app/painel/page.tsx`** (adiciona links Pedidos/Financeiro e o bloco de contato)

```tsx
// app/painel/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStoreSettings } from '@/lib/data/settings'
import { setWholesaleThreshold, setStoreContact } from './settings-actions'
import { logout } from './login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function PainelHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const settings = await getStoreSettings()

  async function salvarLimite(formData: FormData) {
    'use server'
    await setWholesaleThreshold(Number(formData.get('threshold')))
  }
  async function salvarContato(formData: FormData) {
    'use server'
    await setStoreContact(String(formData.get('storeName') ?? ''), String(formData.get('whatsapp') ?? ''))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel Karolla Fit</h1>
        <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href="/painel/produtos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Produtos</Link>
        <Link href="/painel/pedidos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pedidos</Link>
        <Link href="/painel/financeiro" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Financeiro</Link>
      </div>

      <form action={salvarLimite} className="max-w-sm space-y-2 rounded-xl border border-border p-4">
        <Label htmlFor="threshold" className="text-sm font-medium">Peças para virar atacado</Label>
        <p className="text-xs text-muted-foreground">A partir desta quantidade de peças que contam, o carrinho do cliente vira atacado.</p>
        <div className="flex gap-2">
          <Input id="threshold" name="threshold" type="number" min={1} defaultValue={settings.wholesaleThreshold} className="w-24" />
          <Button type="submit">Salvar</Button>
        </div>
      </form>

      <form action={salvarContato} className="max-w-sm space-y-3 rounded-xl border border-border p-4">
        <div className="space-y-1">
          <Label htmlFor="storeName" className="text-sm font-medium">Nome da loja</Label>
          <Input id="storeName" name="storeName" defaultValue={settings.storeName} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp da loja</Label>
          <p className="text-xs text-muted-foreground">Com código do país e DDD, só números. Ex: 5511999998888</p>
          <Input id="whatsapp" name="whatsapp" defaultValue={settings.whatsappNumber} placeholder="5511999998888" />
        </div>
        <Button type="submit">Salvar contato</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Verificar tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/painel/settings-actions.ts app/painel/page.tsx
git commit -m "feat(painel): configurar WhatsApp/nome da loja + links pedidos/financeiro"
```

---

## Task 11: Envio do menu salva o pedido + usa o WhatsApp configurado

**Files:** Modify `components/cart.tsx`, `app/_components/catalog.tsx`, `app/page.tsx`

- [ ] **Step 1: `app/page.tsx` passa `whatsappNumber` ao Catalog**

Trocar a renderização final por (passa o número das settings):

```tsx
  return <Catalog products={products} threshold={settings.wholesaleThreshold} whatsappNumber={settings.whatsappNumber} />
```

- [ ] **Step 2: `app/_components/catalog.tsx` repassa ao Cart**

Atualizar a assinatura e o `<Cart/>`:

```tsx
export function Catalog({ products, threshold, whatsappNumber }: { products: ProductWithVariants[]; threshold: number; whatsappNumber: string }) {
```
e no fim do componente:
```tsx
      <Cart threshold={threshold} whatsappNumber={whatsappNumber} />
```

- [ ] **Step 3: `components/cart.tsx` — salvar o pedido antes do WhatsApp**

No topo, adicionar o import:
```tsx
import { criarPedido } from '@/app/_actions/criar-pedido'
```
Trocar a assinatura do componente para receber `whatsappNumber`:
```tsx
export function Cart({ threshold, whatsappNumber }: { threshold: number; whatsappNumber: string }) {
```
Adicionar um estado de aviso logo após os outros `useState`:
```tsx
  const [aviso, setAviso] = useState<string | null>(null)
```
Substituir a função `handleSendOrder` inteira por esta versão (salva o pedido, usa o número configurado, e tem fallback):
```tsx
  const handleSendOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim()) return
    setIsLoading(true)
    setAviso(null)

    let numeroPedido: number | null = null
    try {
      const r = await criarPedido({
        customerName,
        customerPhone,
        items: items.map((i) => ({ productId: i.product.id, size: i.size, color: i.color, quantity: i.quantity })),
      })
      numeroPedido = r.number
    } catch {
      setAviso('Pedido enviado pelo WhatsApp, mas não foi registrado no painel. Confira lá depois.')
    }

    const header = numeroPedido ? `*PEDIDO #${numeroPedido} — KAROLLA FIT*` : '*PEDIDO KAROLLA FIT*'
    const orderText = header + '\n' + generateOrderText()
    const phone = (whatsappNumber || '').replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(orderText)}`, '_blank')

    setTimeout(() => {
      setIsLoading(false)
      clearCart()
      setShowCheckout(false)
      setIsOpen(false)
      setCustomerName('')
      setCustomerPhone('')
    }, 1000)
  }
```
Remover do `generateOrderText` a primeira linha que dizia `*PEDIDO KAROLLA FIT*` (agora o cabeçalho vem do `header` acima). Em `generateOrderText`, trocar:
```tsx
    let text = `*PEDIDO KAROLLA FIT*\n`
    text += `Data: ${date}\n\n`
```
por:
```tsx
    let text = `Data: ${date}\n\n`
```
Remover também a linha do `phoneNumber` placeholder dentro de `handleSendOrder` que existia antes (`const phoneNumber = '5500000000000'`) — já não é usada (a nova função acima a substitui inteira).

Logo antes do botão de enviar (no bloco do checkout, antes do `<Button onClick={handleSendOrder}...`), mostrar o aviso quando houver:
```tsx
                    {aviso && <p className="text-xs text-amber-500">{aviso}</p>}
```

- [ ] **Step 4: GATES**

Run: `pnpm exec tsc --noEmit` → sem erros.
Run: `pnpm test` → todos PASS (cart.helpers, order.helpers, finance, mappers, produto-schema, products.helpers).

- [ ] **Step 5: Commit**

```bash
git add components/cart.tsx app/_components/catalog.tsx app/page.tsx
git commit -m "feat(site): envio salva o pedido no painel e usa o WhatsApp configurado"
```

---

## Task 12: Verificação final

- [ ] **Step 1: Testes + tipos**

Run: `pnpm test` → todos PASS.
Run: `pnpm exec tsc --noEmit` → sem erros.
Run: `pnpm build` → build de produção sem erros.

- [ ] **Step 2: Checklist funcional (manual, com a migration 0004 já rodada — Task 0)**

- [ ] Cadastre/garanta 1 produto com estoque. No site, monte um carrinho e envie → abre o WhatsApp com `#número`, e o pedido aparece em **Painel → Pedidos (Pendentes)**.
- [ ] O preço do pedido salvo respeita a regra (4+ peças que contam → atacado).
- [ ] **Dar baixa** → estoque do produto desce; o pedido vira **Baixado**.
- [ ] Tente dar baixa com estoque insuficiente (zere o estoque e baixe) → mostra "Estoque insuficiente para: …".
- [ ] **Cancelar** um pendente → vira Cancelado, estoque não muda.
- [ ] **Financeiro** do mês mostra as vendas baixadas; com custo preenchido, o lucro aparece.
- [ ] No painel, configure o **WhatsApp** → o site passa a abrir nesse número.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "chore: fase 2 (pedidos, baixa de estoque, financeiro) concluída"
```

---

## Notas para depois (fora do escopo da Fase 2)

- Tela de **valor de estoque parado** (custo/atacado/varejo, lucro potencial).
- Movimentações de **entrada** (reposição) e despesas/lucro líquido.
- Reserva de estoque com cronômetro, tempo real / som de novo pedido.
