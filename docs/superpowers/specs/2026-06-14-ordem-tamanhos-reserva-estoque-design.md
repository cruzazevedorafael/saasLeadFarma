# Ordem dos tamanhos + reserva de estoque no pedido

Data: 2026-06-14

## Contexto

Dois ajustes pedidos pela loja:

1. **Ordem dos tamanhos** no catálogo (o mesmo que é enviado pelo WhatsApp) está
   embaralhada — deveria ser P, M, G, GG.
2. **Reserva de estoque**: hoje o estoque só baixa quando a loja clica "Dar baixa"
   no painel. A loja quer que o estoque saia já quando o cliente finaliza o pedido,
   para evitar que outro cliente compre a mesma peça, e quer poder **cancelar** um
   pedido no painel devolvendo as peças ao estoque.

## Estado atual relevante

- `lib/data/products.helpers.ts` → `sizesOf()` devolve os tamanhos na ordem em que
  vêm do banco (sem ordenação). Usado na vitrine (`components/product-card.tsx`).
- `app/_actions/criar-pedido.ts` → `criarPedido()` insere `orders` (status
  `pending`) + `order_items`. **Não mexe no estoque.** Calcula `stockWarning` só
  para aviso; estoque insuficiente **não bloqueia** o pedido (regra existente).
- `supabase/migrations/0004_pedidos.sql` → função `complete_order(uuid)`: valida
  estoque, **desconta** e marca `completed`. É chamada por "Dar baixa".
- `app/painel/pedidos/actions.ts` → `cancelarPedido()` só marca `cancelled`, **não
  mexe no estoque**. `darBaixa()` chama `complete_order`.
- Catálogo público lê o estoque das variações, então reduzir o estoque reflete
  automaticamente na vitrine (peça vira "Esgotado").

## Decisões

- **Estoque furado (corrida)**: deixa passar com aviso. O pedido entra mesmo
  assim, o estoque pode ficar **negativo**, e o aviso "estoque insuficiente"
  continua aparecendo no painel. Mantém a regra atual de não bloquear. Estoque
  negativo é sinal de venda além do físico, que a loja resolve com o cliente.
- **"Dar baixa"** passa a significar apenas "confirmar a venda": o estoque já saiu
  na criação do pedido, então só marca `completed` e tira da lista de Pendentes.
- **Reserva simétrica**: reservar desconta a quantidade pedida (pode ir a
  negativo); cancelar soma a mesma quantidade de volta. Sempre simétrico, sem
  rastrear "quanto foi de fato reservado".

## Desenho

### Parte 1 — Ordem dos tamanhos

`sizesOf()` passa a ordenar a saída por uma sequência canônica:

```
PP, P, M, G, GG, XG, XGG, G1, G2, G3
```

Regras do comparador:
- Tamanho que está na lista canônica → ordena pelo índice da lista.
- Tamanho puramente numérico (36, 38, 40…) → ordem crescente, depois dos
  conhecidos por letra.
- Qualquer outro → ordem alfabética, no fim.

Como toda a vitrine usa `sizesOf`, o catálogo passa a exibir sempre na ordem
certa. Acrescenta teste em `lib/data/products.helpers.test.ts`.

### Parte 2 — Reserva de estoque

Fluxo final:

| Momento | Estoque | Status |
|---|---|---|
| Cliente finaliza o pedido | sai na hora (reservado) | `pending` |
| Loja clica "Dar baixa" (confirma venda) | não mexe (já saiu) | `completed` |
| Loja clica "Cancelar" | volta pro estoque | `cancelled` |

**Pré-requisito (constraint):** a coluna `product_variants.stock` tinha
`check (stock >= 0)` (migration 0001). Como a regra agora permite estoque
negativo (sinal de venda além do físico, e reserva simétrica com o cancelamento),
a migration **remove essa constraint** antes de tudo
(`drop constraint if exists product_variants_stock_check`). Sem isso, reservar a
última peça numa corrida levantaria erro e bloquearia o pedido.

**Funções SQL (atômicas, `security definer`, só `service_role`):**

- **`reserve_order(p_order_id uuid)`** — nova. Faz o loop dos `order_items` com
  `variant_id` e `update product_variants set stock = stock - quantity`. **Permite
  negativo** (não valida, não bloqueia). Não altera status.
- **`complete_order(uuid)`** — alterada. Remove o desconto de estoque e a checagem
  de estoque insuficiente. Mantém: trava a linha do pedido, exige status
  `pending`, marca `completed` + `completed_at`.
- **`cancel_order(p_order_id uuid)`** — nova. Trava a linha do pedido, exige status
  `pending` (trava contra devolver duas vezes), faz o loop somando
  `stock = stock + quantity`, marca `cancelled` + `cancelled_at`.

**Código da aplicação:**

- `criarPedido` (`app/_actions/criar-pedido.ts`): após inserir `order_items`,
  chama `reserve_order(order.id)`. Se der erro, apaga o pedido (e itens via
  cascade) e retorna `{ ok: false }`. O cálculo de `stockWarning` continua igual.
- `cancelarPedido` (`app/painel/pedidos/actions.ts`): passa a chamar
  `cancel_order(orderId)` via RPC em vez do `update` direto.
- `darBaixa` continua chamando `complete_order` (agora sem desconto).
- `app/painel/pedidos/_components/pedido-actions.tsx`: texto do diálogo de cancelar
  muda de "Não mexe no estoque" para "Os itens voltam para o estoque".

**Migração dos pedidos já pendentes:** na própria migration SQL, um `UPDATE`
único que desconta o estoque dos itens de todos os pedidos com status `pending`
no momento, para que todos fiquem na nova regra (pendente = já reservado). Assim
cancelar qualquer pedido antigo devolve a quantidade certa.

**Arquivos de migration:** novos `supabase/migrations/0015_*.sql` (e seguintes se
necessário), aplicados manualmente no painel do Supabase, na ordem, antes do
merge na main (processo já existente da loja).

## Fora de escopo

- Coluna separada de "reservado" vs "físico" (mantemos um único `stock`).
- Expiração automática de pedidos pendentes (a loja cancela manualmente).
- Bloquear pedido por falta de estoque.

## Testes

- `products.helpers.test.ts`: ordenação canônica de tamanhos (letras fora de
  ordem, numéricos, tamanho desconhecido no fim).
- `criar-pedido.test.ts`: garantir que a reserva é chamada e que falha na reserva
  apaga o pedido.
- Verificação manual no painel: criar pedido → estoque cai; cancelar → estoque
  volta; dar baixa → estoque permanece.
