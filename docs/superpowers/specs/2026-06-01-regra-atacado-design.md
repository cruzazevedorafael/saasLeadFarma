# Design — Regra de atacado por carrinho + flag "não conta"

**Data:** 2026-06-01
**Status:** Aprovado
**Refina:** [2026-05-24-painel-karolla-fit-design.md](2026-05-24-painel-karolla-fit-design.md) (Fase 1)
**Plano afetado:** [../plans/2026-05-24-painel-fase-1-catalogo.md](../plans/2026-05-24-painel-fase-1-catalogo.md)

## 1. Contexto

O menu é enviado por link à cliente, que escolhe as peças. A dona quer que o
preço de **atacado** seja aplicado automaticamente por quantidade, não escolhido
à mão. Problema real: clientes "burlavam" o mínimo adicionando itens baratos
(ex: 1 peça + 3 meias = 4) só pra destravar o atacado. Por isso, certas peças
**não devem contar** para atingir o atacado.

Isto **substitui** o modelo anterior (mínimo por produto `min_wholesale` +
botão manual varejo/atacado no card), que estava no código herdado do site.

## 2. Regra (definição única e autoritativa)

> Soma as **peças que contam** no carrinho (quantidade, somando unidades).
> Se o total **≥ `wholesale_threshold`** (padrão **4**, configurável no painel),
> **todo o carrinho** passa para o preço de **atacado** — inclusive as peças
> marcadas como "não contam". Abaixo do limite, **tudo** fica no varejo.

Decisões confirmadas com o usuário:
- **4 unidades que contam** já disparam o atacado (4 do mesmo produto contam).
- A peça "não conta" (ex: meia): **não soma** para atingir o limite, mas
  **pega o preço de atacado junto** quando o carrinho já virou atacado.
- O preço passa a ser **um tipo único do carrinho** (`retail` | `wholesale`),
  não mais um por item. Sem escolha manual da cliente.

### Exemplos
| Carrinho | Conta | Resultado |
|----------|-------|-----------|
| 2 Legging + 1 Top + 1 Short (todas contam) | 4 | **Atacado** em tudo |
| 4 Legging iguais (conta) | 4 | **Atacado** |
| 1 Legging (conta) + 3 Meias (não conta) | 1 | **Varejo** em tudo |
| 4 Legging (conta) + 2 Meias (não conta) | 4 | **Atacado** em tudo, meia inclusa |
| 5 Meias (não conta) | 0 | **Varejo** |

## 3. Modelo de dados (delta — 1 migration nova, não destrutiva)

`supabase/migrations/0003_regra_atacado.sql`:

- **`products`** → nova coluna
  `counts_for_wholesale boolean not null default true`
  (o "tick" do cadastro: marcado = conta; desmarcado = meia/brinde).
- **`store_settings`** → nova coluna
  `wholesale_threshold int not null default 4` (o "4" configurável).
- **View `public_products`** → recriar incluindo `counts_for_wholesale`.
  (Não expõe mais a necessidade de `min_wholesale` para a regra; a coluna
  permanece na tabela base por ora, sem uso — sem migration destrutiva.)
- O anon **já** pode ler `store_settings` (policy existente) → o site lê o
  `wholesale_threshold` de lá.

## 4. Lógica de preço (funções puras + TDD)

Em `lib/data/cart.helpers.ts` (novo), funções puras testáveis:

- `countingQuantity(items): number` — soma `quantity` apenas dos itens cujo
  produto tem `counts_for_wholesale === true`.
- `cartPriceType(items, threshold): 'retail' | 'wholesale'` —
  `countingQuantity(items) >= threshold ? 'wholesale' : 'retail'`.
- `unitPriceFor(product, priceType): number` — atacado/varejo do produto.
- `cartTotal(items, priceType): number` — soma `unitPriceFor × quantity` de
  todos os itens usando o **mesmo** `priceType` do carrinho.
- `piecesUntilWholesale(items, threshold): number` — quantas peças que contam
  faltam (para a mensagem "faltam N peças pro atacado").

Testes cobrindo todos os exemplos da tabela acima, incluindo: item que não
conta não soma; quando atinge o limite, item que não conta também vai a
atacado; limite configurável.

## 5. Camada de dados / tipos (delta)

- `lib/data/types.ts` → `Product` ganha `countsForWholesale: boolean`;
  **remove** `minWholesale` do tipo do app (deixa de ser usado).
- `lib/data/mappers.ts` → mapear `counts_for_wholesale` → `countsForWholesale`;
  parar de mapear `min_wholesale`.
- `lib/data/products.ts` → views já trazem o novo campo (via `select('*')`).
- `lib/data/settings.ts` (novo) → `getStoreSettings()` lê `store_settings`
  (inclui `wholesale_threshold`), com cliente server/anon.
- `lib/data/products.helpers.ts` → remover `priceForQuantity` (regra antiga,
  por produto); a precificação passa para `cart.helpers.ts`.

## 6. Site público (cliente)

- **Card do produto** (`components/product-card.tsx`): **remover** o botão
  manual varejo/atacado. Mostrar os dois preços como informação
  ("Varejo R$ X · Atacado R$ Y"). Peça com `countsForWholesale === false`
  ganha etiqueta discreta "não conta pro atacado".
- **Carrinho** (`components/cart.tsx`): calcular `cartPriceType` com o
  `wholesale_threshold` carregado das settings; exibir destaque de status
  ("Faltam N peças pro atacado" / "✓ Preço de atacado aplicado") e recalcular
  o total ao vivo. A mensagem do WhatsApp sai com o tipo aplicado e o total
  correto.
- **Store** (`lib/store.ts`): `CartItem.priceType` deixa de ser definido na
  adição; o tipo é **derivado** do carrinho inteiro. `getTotalPrice()` passa a
  receber/usar o `threshold` (ou o componente calcula via `cart.helpers.ts`).
  O threshold chega do server via prop para o componente do carrinho.

## 7. Painel (Fase 1, com o tick)

- **Formulário de produto**: checkbox **"Esta peça conta pro atacado"**
  (default marcado) → grava `counts_for_wholesale`. Remover o campo
  "qtd mín. atacado" (`min_wholesale`) do formulário e do schema zod.
- **Config mínima do limite**: um único campo no painel para editar
  `wholesale_threshold` (quantidade de peças pra virar atacado), com server
  action salvando em `store_settings`. **Não** é a tela de Configurações
  completa (essa segue na Fase 2) — apenas este campo.
- Restante do CRUD (criar/editar/remover/ativar, upload de foto, grade de
  variações) segue o plano da Fase 1 sem alteração.

## 8. Impacto no plano da Fase 1 existente

- **Task 7 (seed)**: incluir `counts_for_wholesale` (todos `true` no seed
  inicial; a dona desmarca as meias depois). Não precisa mais semear
  `min_wholesale` de forma significativa.
- **Task 8 (site público)**: ajustar para o novo modelo de preço (remover
  toggle, usar `cart.helpers.ts` + threshold das settings).
- **Task 11 (schema zod)**: trocar `minWholesale` por `countsForWholesale`.
- **Task 12/13 (actions/form)**: gravar `counts_for_wholesale`; remover
  `min_wholesale`.
- **Novas tasks**: migration 0003; `cart.helpers.ts` + testes;
  `lib/data/settings.ts`; campo de config do limite no painel.

## 9. Casos de borda

- Carrinho só com itens que não contam → sempre varejo (intencional).
- Limite alterado no painel → o site recalcula na próxima carga (lê settings).
- Threshold = 1 → qualquer peça que conta já é atacado (válido).
- Item adicionado/removido → status do carrinho e total recalculam ao vivo.

## 10. Fora de escopo (mantém YAGNI da Fase 1)

- Tela de Configurações completa (nome da loja, WhatsApp, minutos de reserva) —
  Fase 2.
- Reserva de estoque / pedidos — Fase 2.
- Limite ou regra diferente por categoria — não pedido.
