# Design — Fase 2: Pedidos, baixa de estoque e financeiro

**Data:** 2026-06-01
**Status:** Aprovado
**Continua:** [2026-06-01-regra-atacado-design.md](2026-06-01-regra-atacado-design.md) (Fase 1, no ar)
**Substitui:** o desenho da Fase 2 em [2026-05-24-painel-karolla-fit-design.md](2026-05-24-painel-karolla-fit-design.md) §11 — a dona optou por um modelo **mais simples** (sem reserva com cronômetro).

## 1. Contexto

A Fase 1 está publicada (menu lê o Supabase, painel CRUD de produtos, regra de
atacado por carrinho). Hoje o pedido **só** abre o WhatsApp — não fica registrado
em lugar nenhum e o estoque não baixa. A Fase 2 fecha esse laço: o pedido vira
um registro no painel, a dona dá baixa (o estoque desconta), e ela vê o
resultado financeiro do mês.

## 2. Decisões tomadas (confirmadas com a dona)

| Tema | Decisão |
|------|---------|
| Modelo de estoque | **Baixa manual, sem reserva/cronômetro.** O estoque só desconta quando a dona clica "Dar baixa". |
| Aviso de pedido novo | **Lista simples** no painel (sem tempo real / som). O aviso "na hora" é a mensagem que já chega no WhatsApp dela. |
| Financeiro | **Resumo de vendas/lucro do mês** (com gráfico). **Sem** tela de valor de estoque parado (fica para depois). |
| WhatsApp | Número da loja **configurável** no painel; o menu passa a usar ele. |
| Preço do pedido | **Recalculado no servidor** ao salvar (reusa a regra da Fase 1), pra não dar pra burlar pelo navegador. |
| Baixa | **Atômica e valida estoque**: se faltar peça, avisa quais itens e não baixa. |
| Concorrência | Risco aceito: entre o pedido e a baixa, a peça ainda aparece disponível. Resolvido na baixa (avisa se faltar). |

## 3. Fluxo de ponta a ponta

```
Cliente monta carrinho → "Enviar pelo WhatsApp"
   → servidor SALVA o pedido (status PENDENTE, nº #1042, preço recalculado)
   → abre o WhatsApp com o resumo + o nº do pedido
Painel → Pedidos → #1042 PENDENTE
   → dona confere pagamento → "Dar baixa"
       → estoque das peças desconta (atômico, valida)
       → pedido vira BAIXADO (completed_at = agora)
   → ou "Cancelar" (não mexe no estoque)
Baixas do mês → tela Financeiro (vendas, custo, lucro, gráfico)
```

## 4. Modelo de dados (migration nova `0004_pedidos.sql`)

### `orders`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| number | int | **sequencial automático** (sequence começando em 1000), exibido como `#1042` |
| customer_name | text | |
| customer_phone | text | |
| status | text | `pending` · `completed` · `cancelled` (check) |
| price_type | text | `retail` · `wholesale` (snapshot) |
| total | numeric(10,2) | snapshot do total cobrado |
| created_at | timestamptz | criação |
| completed_at | timestamptz | quando deu baixa |
| cancelled_at | timestamptz | quando cancelou |

### `order_items`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| order_id | uuid FK → orders | `on delete cascade` |
| product_id | uuid | denormalizado (pode ficar órfão se o produto for excluído depois) |
| variant_id | uuid | usado na baixa para descontar estoque (nullable) |
| product_code | text | **snapshot** |
| product_name | text | snapshot |
| size / color | text | snapshot |
| quantity | int | |
| unit_price | numeric(10,2) | **snapshot** do preço cobrado |
| unit_cost | numeric(10,2) | **snapshot** do custo (para o lucro) |

> O financeiro do mês é derivado direto de `orders` (status `completed`,
> `completed_at` no mês) + `order_items` — **não** há tabela de movimentações
> nesta fase (era da Fase 3).

### RLS / grants
- `orders` e `order_items`: RLS ligado; **authenticated** (admin) faz tudo.
- O **anon não acessa** essas tabelas diretamente. A criação de pedido pelo
  público passa por uma **server action** (server-side, service-role) — o anon
  nunca escreve no banco direto.

## 5. Lógica crítica

### Criar pedido (público) — server action `criarPedido`
Em `app/_actions/criar-pedido.ts` (ou similar), server-side com o admin client:
1. Recebe `{ customerName, customerPhone, items: [{ productId, size, color, quantity }] }`.
2. **Busca os produtos no banco** (preços, custo, `counts_for_wholesale`) e o
   `wholesale_threshold` das settings — **ignora qualquer preço vindo do cliente**.
3. Resolve `variant_id` por `(product_id, size, color)`.
4. Calcula o tipo de preço e o total **reusando os helpers da Fase 1**
   (`countingQuantity`, `cartPriceType`, `unitPriceFor`, `cartTotal` de
   `lib/data/cart.helpers.ts`) — fonte única da regra.
5. Insere `orders` (`pending`) + `order_items` (com snapshots de preço e custo).
   Se a inserção dos itens falhar, apaga o pedido (limpeza). Retorna
   `{ number, total, priceType }`.
6. **Não valida estoque** na criação (modelo manual). Sem reserva.

> Reaproveita os helpers já testados da Fase 1 — a regra de atacado fica num
> lugar só. O servidor é a autoridade do preço gravado.

### Dar baixa — função Postgres `complete_order(order_id)` (atômica)
Em `0004_pedidos.sql`, `security definer`, EXECUTE para `service_role`
(chamada por server action após checar login):
1. Só age se `status = 'pending'`.
2. Para cada item com `variant_id`: `SELECT ... FOR UPDATE` na variação, confere
   `stock >= quantity`. Se **alguma** faltar, `RAISE EXCEPTION` listando os itens
   sem estoque (a action devolve a mensagem; nada é baixado).
3. Se todas ok, **desconta** `product_variants.stock` de cada item, seta
   `orders.status = 'completed'`, `completed_at = now()`. Tudo numa transação.
4. Item com `variant_id` nulo (variação excluída depois) é **pulado** no desconto
   (a venda completa mesmo assim).

### Cancelar — server action `cancelarPedido(order_id)`
`update orders set status='cancelled', cancelled_at=now() where id=? and status<>'completed'`. Não mexe em estoque.

## 6. Site público — mudanças

- `components/cart.tsx` (`handleSendOrder`): antes de abrir o WhatsApp, chama
  `criarPedido(...)`. Em caso de sucesso, monta a mensagem com o **nº do pedido**
  e o total/tipo **confirmados pelo servidor**, e abre `wa.me` usando o
  **número configurado** (das settings).
- **Falha ao salvar**: abre o WhatsApp mesmo assim (não perde a venda) e mostra
  um aviso ("pedido enviado, mas não registrado no painel — confira lá").
- O número do WhatsApp e (continua) o `threshold` chegam por prop do servidor
  (`getStoreSettings`). Sai o placeholder `5500000000000`.
- Disponibilidade no site **não muda**: continua `stock > 0` pela view pública;
  o estoque agora realmente baixa quando a dona dá baixa.

## 7. Painel — telas novas

### Pedidos (`/painel/pedidos`)
- Server Component (auth), lê pedidos + itens (admin). Filtros por status
  (Pendentes / Baixados / Cancelados / Todos) via query param.
- Cada pedido: **nº**, nome + **telefone (botão WhatsApp `wa.me`)**, itens
  (código + produto + tam/cor + qtd), **total** e selo **Atacado/Varejo**, e a
  data. Ações (client): **Dar baixa** e **Cancelar**.
- Erro de baixa por falta de estoque → mostra **quais itens** faltaram.

### Financeiro (`/painel/financeiro`)
- Server Component (auth). Seletor de **mês** (padrão: mês atual).
- Lê pedidos `completed` com `completed_at` no mês + seus itens. Calcula:
  **Vendas** = Σ `unit_price × quantity`; **Custo** = Σ `unit_cost × quantity`;
  **Lucro** = Vendas − Custo.
- **Gráfico** (recharts, já instalado): vendas por dia no mês.
- ⚠️ O **lucro** depende do **custo** preenchido no produto (hoje 0). As vendas
  aparecem de qualquer forma; só o lucro fica zerado sem custo.

### Configurações (no painel)
- Campo do **número do WhatsApp** da loja e **nome da loja**, salvando em
  `store_settings`. Fica junto do campo de limite de atacado que já existe na
  home do painel (ou numa pequena tela de Configurações). Server action
  dedicada.

## 8. Camada de dados / arquivos

- `lib/data/orders.ts` — `getAdminOrders(status?)`, `getOrderWithItems(id)`,
  e wrappers das operações (`completeOrder` via RPC, `cancelOrder`).
- `lib/data/finance.ts` — `getMonthlySummary(year, month)` (puro o suficiente
  pra testar a agregação de receita/custo/lucro).
- `lib/data/settings.ts` — já tem `getStoreSettings`; ganha update de
  WhatsApp/nome (via server action).
- `app/painel/pedidos/*`, `app/painel/financeiro/*`, `app/_actions/criar-pedido.ts`.

## 9. Testes

- **Unitário**: agregação do financeiro (`getMonthlySummary` — receita/custo/lucro
  a partir de itens) com casos (mês cheio, mês vazio, sem custo → lucro = vendas).
- **Reuso**: o cálculo de preço do pedido reusa `cart.helpers.ts`, **já testado**
  na Fase 1 (não reimplementa a regra).
- **Integração/manual**: `complete_order` (baixa desconta e valida; falta de
  estoque bloqueia e lista itens; pedido já baixado não baixa de novo); fluxo
  E2E (montar pedido → salva pendente → WhatsApp → dar baixa → estoque desce →
  aparece no financeiro).

## 10. Casos de borda

- Dar baixa com estoque insuficiente → bloqueia, lista os itens faltantes.
- Dar baixa em pedido já baixado/cancelado → bloqueado (só `pending` baixa).
- Produto/variação excluído depois do pedido → snapshots preservam os dados; a
  baixa pula o desconto de itens sem `variant_id`.
- Falha de rede ao salvar o pedido → abre o WhatsApp mesmo assim + avisa.
- Envio duplicado do mesmo carrinho → gera 2 pedidos; a dona cancela o repetido.
- Cliente não paga → ela **cancela** o pedido (não há expiração automática).

## 11. Fora de escopo (YAGNI / próximas fases)

- Reserva de estoque com cronômetro/expiração, pg_cron, "refazer pedido".
- Tempo real / som / pop-up de novo pedido.
- Tela de **valor de estoque parado** (custo/atacado/varejo, lucro potencial).
- Movimentações de **entrada** (reposição) e lucro líquido / outras despesas.
- Múltiplos usuários, pagamento integrado.
