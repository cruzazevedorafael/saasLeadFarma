# Ordem dos tamanhos + reserva de estoque — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ordenar os tamanhos do catálogo (P, M, G, GG) e fazer o estoque sair quando o cliente finaliza o pedido, com cancelamento no painel devolvendo as peças.

**Architecture:** O catálogo usa `sizesOf()` em um único lugar — basta ordenar a saída por uma sequência canônica. A reserva de estoque vira responsabilidade de funções SQL atômicas no Supabase (`reserve_order` na criação, `complete_order` sem desconto na "baixa", `cancel_order` devolvendo no cancelamento), chamadas pelas server actions.

**Tech Stack:** Next.js (server actions), Supabase (Postgres + RPC `security definer`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-ordem-tamanhos-reserva-estoque-design.md`

---

## Arquivos afetados

- Modificar: `lib/data/products.helpers.ts` — ordenação canônica em `sizesOf`.
- Modificar: `lib/data/products.helpers.test.ts` — testes da ordenação.
- Criar: `supabase/migrations/0015_reserva_estoque.sql` — funções + migração única.
- Modificar: `app/_actions/criar-pedido.ts` — chamar `reserve_order` após inserir itens.
- Modificar: `app/_actions/criar-pedido.test.ts` — fake `rpc` + teste de rollback.
- Modificar: `app/painel/pedidos/actions.ts` — `cancelarPedido` chama `cancel_order`.
- Modificar: `app/painel/pedidos/_components/pedido-actions.tsx` — texto do diálogo.

---

## Task 1: Ordenar os tamanhos em `sizesOf`

**Files:**
- Modify: `lib/data/products.helpers.ts`
- Test: `lib/data/products.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar dentro do `describe('sizesOf / colorsOf', ...)` existente em `lib/data/products.helpers.test.ts` (logo após o teste `'lista tamanhos distintos'`):

```ts
  it('ordena os tamanhos por P, M, G, GG mesmo vindo embaralhado', () => {
    const prod: ProductWithVariants = {
      ...p,
      variants: [
        { id: 'a', productId: '1', size: 'GG', color: 'Preto', stock: 1 },
        { id: 'b', productId: '1', size: 'P', color: 'Preto', stock: 1 },
        { id: 'c', productId: '1', size: 'G', color: 'Preto', stock: 1 },
        { id: 'd', productId: '1', size: 'M', color: 'Preto', stock: 1 },
      ],
    }
    expect(sizesOf(prod)).toEqual(['P', 'M', 'G', 'GG'])
  })

  it('tamanhos numéricos em ordem crescente, depois das letras', () => {
    const prod: ProductWithVariants = {
      ...p,
      variants: [
        { id: 'a', productId: '1', size: '40', color: 'Preto', stock: 1 },
        { id: 'b', productId: '1', size: 'M', color: 'Preto', stock: 1 },
        { id: 'c', productId: '1', size: '38', color: 'Preto', stock: 1 },
      ],
    }
    expect(sizesOf(prod)).toEqual(['M', '38', '40'])
  })

  it('tamanho desconhecido vai pro fim', () => {
    const prod: ProductWithVariants = {
      ...p,
      variants: [
        { id: 'a', productId: '1', size: 'Único', color: 'Preto', stock: 1 },
        { id: 'b', productId: '1', size: 'G', color: 'Preto', stock: 1 },
      ],
    }
    expect(sizesOf(prod)).toEqual(['G', 'Único'])
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run lib/data/products.helpers.test.ts`
Expected: FALHA nos novos testes (ex.: recebido `['GG','P','G','M']`, esperado `['P','M','G','GG']`).

- [ ] **Step 3: Implementar a ordenação**

Em `lib/data/products.helpers.ts`, substituir a função `sizesOf` atual:

```ts
export function sizesOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.size))]
}
```

por este bloco (constante + helper + `sizesOf` ordenado), mantendo o resto do arquivo:

```ts
// Ordem canônica das letras. Tamanhos numéricos entram depois (crescente);
// qualquer outro valor vai pro fim, em ordem alfabética.
const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'G1', 'G2', 'G3']

// Chave de ordenação em 3 níveis: [tier, número, texto].
// tier 0 = letra conhecida (ordena pelo índice), 1 = numérico, 2 = outro.
function sizeKey(size: string): [number, number, string] {
  const u = size.trim().toUpperCase()
  const known = SIZE_ORDER.indexOf(u)
  if (known !== -1) return [0, known, '']
  const n = Number(u)
  if (u !== '' && !Number.isNaN(n)) return [1, n, '']
  return [2, 0, u]
}

function compareSizes(a: string, b: string): number {
  const [ta, na, sa] = sizeKey(a)
  const [tb, nb, sb] = sizeKey(b)
  if (ta !== tb) return ta - tb
  if (na !== nb) return na - nb
  return sa.localeCompare(sb)
}

export function sizesOf(p: ProductWithVariants): string[] {
  return [...new Set(p.variants.map((v) => v.size))].sort(compareSizes)
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run lib/data/products.helpers.test.ts`
Expected: PASSA tudo (inclusive o teste antigo `'lista tamanhos distintos'`, que espera `['M','G']` — continua correto, M antes de G).

- [ ] **Step 5: Commit**

```bash
git add lib/data/products.helpers.ts lib/data/products.helpers.test.ts
git commit -m "feat: ordena tamanhos do catálogo por P, M, G, GG"
```

---

## Task 2: Migration SQL — reserva, baixa e cancelamento

**Files:**
- Create: `supabase/migrations/0015_reserva_estoque.sql`

> Sem teste automatizado: funções Postgres. A verificação é aplicar no painel do
> Supabase (processo manual da loja, antes do merge). A consistência com o código
> é validada nas Tasks 3 e 4.

- [ ] **Step 1: Criar o arquivo de migration**

Criar `supabase/migrations/0015_reserva_estoque.sql` com o conteúdo:

```sql
-- supabase/migrations/0015_reserva_estoque.sql
-- Reserva de estoque no momento do pedido.
-- A partir daqui: pedido criado => estoque já sai (pending = reservado).
-- "Dar baixa" (complete_order) só confirma a venda; "Cancelar" (cancel_order) devolve.

-- 1) Reserva: desconta o estoque dos itens do pedido. Permite negativo (não bloqueia).
create or replace function public.reserve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock - r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;
end;
$$;
revoke all on function public.reserve_order(uuid) from public, anon;
grant execute on function public.reserve_order(uuid) to service_role;

-- 2) Dar baixa: o estoque já saiu na criação; aqui só confirma a venda.
create or replace function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;

  update public.orders set status='completed', completed_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to service_role;

-- 3) Cancelar: devolve as peças ao estoque. Trava no status pending (não devolve 2x).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  r record;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;

  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock + r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;

  update public.orders set status='cancelled', cancelled_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to service_role;

-- 4) Migração única: reserva o estoque dos pedidos que já estão pendentes,
-- pra todos ficarem na nova regra (pendente = já reservado).
update public.product_variants pv
set stock = pv.stock - agg.qty, updated_at = now()
from (
  select oi.variant_id, sum(oi.quantity) as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'pending' and oi.variant_id is not null
  group by oi.variant_id
) agg
where pv.id = agg.variant_id;
```

- [ ] **Step 2: Validar o SQL visualmente**

Conferir: as 3 funções têm `revoke ... from public, anon` + `grant execute ... to service_role`; o `update` final só toca pedidos `pending`. Sem rodar nada localmente.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_reserva_estoque.sql
git commit -m "feat: funções SQL de reserva/baixa/cancelamento de estoque"
```

> **Lembrete de deploy:** aplicar este SQL no painel do Supabase antes de mergear na
> main (a main faz deploy automático). É um arquivo só — colar e rodar inteiro.

---

## Task 3: `criarPedido` reserva o estoque após inserir os itens

**Files:**
- Modify: `app/_actions/criar-pedido.ts`
- Test: `app/_actions/criar-pedido.test.ts`

- [ ] **Step 1: Adicionar suporte a `rpc` no fake DB e o teste de rollback**

Em `app/_actions/criar-pedido.test.ts`:

(a) Adicionar a variável de estado mutável, junto das outras no topo:

```ts
let rpcError: any = null
let deletedOrderIds: string[] = []
```

(b) No `fakeDb()`, adicionar o método `rpc` e capturar o delete. Substituir o bloco da tabela `orders`:

```ts
      if (table === 'orders') {
        return {
          insert: (row: any) => {
            insertedOrders.push(row)
            return { select: () => ({ single: async () => ({ data: { id: 'o1', number: 7 }, error: orderInsertError }) }) }
          },
          delete: () => ({ eq: async (_col: string, id: string) => { deletedOrderIds.push(id); return { error: null } } }),
        }
      }
```

e, logo antes do `throw new Error(...)` final do `fakeDb`, antes do fechamento do objeto retornado, adicionar a propriedade `rpc` ao objeto (irmã de `from`):

```ts
    async rpc(_name: string, _params: any) {
      return { error: rpcError }
    },
```

(c) No `beforeEach`, resetar os novos estados:

```ts
  rpcError = null
  deletedOrderIds = []
```

(d) Adicionar dois testes dentro do `describe('criarPedido', ...)`:

```ts
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
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: FALHA no teste `'falha na reserva...'` (hoje `criarPedido` não chama `rpc`, então o pedido não é apagado e `r.ok` volta `true`).

- [ ] **Step 3: Chamar `reserve_order` em `criarPedido`**

Em `app/_actions/criar-pedido.ts`, localizar o bloco que insere os itens:

```ts
  const itemRows = built.items.map((it) => ({ ...it, order_id: order.id }))
  const { error: iErr } = await db.from('order_items').insert(itemRows)
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw iErr
  }

  return { ok: true, number: order.number as number, total: built.total, priceType: built.priceType, stockWarning }
```

e inserir a reserva entre o bloco do `iErr` e o `return`:

```ts
  const itemRows = built.items.map((it) => ({ ...it, order_id: order.id }))
  const { error: iErr } = await db.from('order_items').insert(itemRows)
  if (iErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw iErr
  }

  // Reserva o estoque (desconta as peças). Pode ficar negativo — não bloqueia,
  // o stockWarning acima já avisa a loja. Se a reserva falhar, desfaz o pedido.
  const { error: rErr } = await db.rpc('reserve_order', { p_order_id: order.id })
  if (rErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw rErr
  }

  return { ok: true, number: order.number as number, total: built.total, priceType: built.priceType, stockWarning }
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run app/_actions/criar-pedido.test.ts`
Expected: PASSA tudo, inclusive os testes antigos (sucesso, estoque insuficiente, produto inexistente, erro de banco).

- [ ] **Step 5: Commit**

```bash
git add app/_actions/criar-pedido.ts app/_actions/criar-pedido.test.ts
git commit -m "feat: reserva estoque ao registrar o pedido"
```

---

## Task 4: `cancelarPedido` devolve o estoque + texto do painel

**Files:**
- Modify: `app/painel/pedidos/actions.ts`
- Modify: `app/painel/pedidos/_components/pedido-actions.tsx`

> Sem teste automatizado (server action de painel sem suite existente). Verificação
> manual na Task 5.

- [ ] **Step 1: Trocar o update direto por `cancel_order`**

Em `app/painel/pedidos/actions.ts`, substituir a função `cancelarPedido` inteira:

```ts
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

por:

```ts
export async function cancelarPedido(orderId: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const db = createAdminClient()
  // Devolve as peças ao estoque e marca como cancelado, atômico no banco.
  const { error } = await db.rpc('cancel_order', { p_order_id: orderId })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/painel/pedidos')
  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Atualizar o texto do diálogo de cancelamento**

Em `app/painel/pedidos/_components/pedido-actions.tsx`, trocar a descrição do diálogo:

```tsx
              <AlertDialogDescription>O pedido fica marcado como cancelado. Não mexe no estoque.</AlertDialogDescription>
```

por:

```tsx
              <AlertDialogDescription>O pedido é cancelado e as peças voltam para o estoque.</AlertDialogDescription>
```

- [ ] **Step 3: Confirmar que compila e os testes seguem verdes**

Run: `npx vitest run && npx tsc --noEmit`
Expected: testes PASSAM e `tsc` sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/painel/pedidos/actions.ts app/painel/pedidos/_components/pedido-actions.tsx
git commit -m "feat: cancelar pedido devolve as peças ao estoque"
```

---

## Task 5: Verificação manual (após aplicar a migration no Supabase)

> Pré-requisito: ter aplicado `0015_reserva_estoque.sql` no painel do Supabase.

- [ ] **Catálogo:** abrir um produto com tamanhos P/M/G/GG cadastrados fora de ordem
  e confirmar que aparecem na ordem P, M, G, GG.
- [ ] **Reserva:** anotar o estoque de uma variação, fazer um pedido dela pelo
  catálogo e confirmar no painel de produtos que o estoque caiu pela quantidade pedida.
- [ ] **Cancelar:** no painel de pedidos, cancelar esse pedido e confirmar que o
  estoque voltou ao valor original.
- [ ] **Dar baixa:** fazer outro pedido, clicar "Dar baixa" e confirmar que o estoque
  permanece (não cai de novo) e o pedido sai dos Pendentes para Baixados.

---

## Self-review (preenchido pelo autor do plano)

- **Cobertura do spec:** ordenação de tamanhos (Task 1), `reserve_order`/`complete_order`/`cancel_order` + migração de pendentes (Task 2), reserva na criação (Task 3), cancelamento devolvendo + texto do painel (Task 4), verificação manual (Task 5). Decisão "não bloqueia / permite negativo" refletida no `reserve_order` (sem checagem) e no comentário do código. ✓
- **Sem placeholders:** todos os passos têm código/SQL/comando concretos. ✓
- **Consistência de nomes:** RPCs `reserve_order` / `complete_order` / `cancel_order` e o param `p_order_id` batem entre SQL (Task 2) e chamadas JS (Tasks 3 e 4). ✓
