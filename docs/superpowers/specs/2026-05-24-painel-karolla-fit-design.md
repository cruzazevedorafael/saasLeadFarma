# Design — Painel de Gestão Karolla Fit

**Data:** 2026-05-24
**Status:** Aprovado (construção em 3 fases)

## 1. Contexto

O projeto atual (`v0-logo-de-fitness`) é um **menu digital** para uma loja de moda fitness (atacado e varejo). A loja envia o link ao cliente, que escolhe os produtos, informa nome e telefone, e o pedido é enviado para o **WhatsApp da loja**.

**Estado atual do código:**
- Site 100% frontend em Next.js 16 (App Router, Turbopack), sem backend nem banco.
- Produtos fixos em [lib/products.ts](../../../lib/products.ts) (array TypeScript) — alterar exige programador + redeploy.
- Tipo `Product` em [lib/store.ts](../../../lib/store.ts) já tem `priceRetail`, `priceWholesale`, `minWholesale`, `sizes[]`, `colors[]`. **Não há campo de estoque.**
- Carrinho em Zustand com persistência em `localStorage`; checkout monta link `wa.me`.
- UI com shadcn/ui + Tailwind v4 + framer-motion. Dependências já presentes úteis: `recharts` (gráficos), `react-hook-form` + `zod` (formulários).

## 2. Objetivo

Permitir que a dona da loja (usuária não técnica) **alimente o site sozinha** e **gerencie o negócio** através de um painel: cadastro de produtos, controle de estoque por variação, sistema de reserva de pedidos com baixa, e visão financeira de estoque e lucro.

## 3. Decisões tomadas (resumo)

| Tema | Decisão |
|------|---------|
| Plataforma de dados | **Supabase** (Postgres + Auth + Storage + Realtime + pg_cron), free tier |
| Onde fica o painel | No mesmo app Next.js, rota `/painel`, protegido por login |
| Nível de estoque | **Por variação** (tamanho + cor) |
| Controle de pedido | **Sistema de reserva**: enviar pedido reserva estoque por **10 min** (configurável); confirmar pagamento dá baixa; expirar devolve estoque |
| Pedido expirado | Não some; é marcado e pode ser **refeito** |
| Aviso de novo pedido | **Som + pop-up no painel** (quando aberto) + a mensagem que já chega no **WhatsApp** dela |
| Código do produto | Campo **`código`** cadastrado no painel, exibido no site, no pedido, no WhatsApp e no painel |
| Preços | **3 preços** por produto: **custo**, **atacado**, **varejo** |
| Cálculo de lucro | **Lucro bruto** = receita das vendas − custo das mercadorias vendidas |
| Construção | **3 fases** (ver seção 11) |

## 4. Arquitetura

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  SITE PÚBLICO   │      │     SUPABASE     │      │  PAINEL (/painel)│
│  (cliente)      │◄────►│  Postgres + Auth │◄────►│  login + gestão  │
│  produtos +     │      │  Storage + Realt.│      │  pedidos/produtos│
│  reserva        │      │  pg_cron         │      │  estoque/financ. │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

- **Site público**: lê produtos/disponibilidade do Supabase; ao enviar, reserva o estoque antes de abrir o WhatsApp.
- **Painel**: app Next.js sob `/painel`, autenticado via Supabase Auth.
- **Supabase**: fonte única da verdade. Lógica crítica (reserva, baixa, expiração) em **funções Postgres (RPC) atômicas**. Expiração agendada via **pg_cron**. Atualização do painel em **tempo real** (Realtime).
- Stack no app: Next.js App Router, `@supabase/supabase-js` + `@supabase/ssr` (auth no Next), shadcn/ui + Tailwind, `recharts` (gráfico financeiro), `react-hook-form` + `zod` (formulários do painel).

## 5. Modelo de dados (Postgres)

### `products`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| code | text | **único**, código humano (ex: `LEG-001`) |
| name | text | |
| category | text | |
| description | text | |
| image_url | text | foto principal (Supabase Storage) |
| price_cost | numeric | **custo** |
| price_wholesale | numeric | atacado |
| price_retail | numeric | varejo |
| min_wholesale | int | qtd mínima p/ preço de atacado |
| active | bool | mostra/esconde no site |
| sort_order | int | ordenação opcional |
| created_at / updated_at | timestamptz | |

### `product_variants` (uma linha por tamanho + cor)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| product_id | uuid FK → products | |
| size | text | |
| color | text | |
| stock | int | quantidade física (≥ 0) |
| created_at / updated_at | timestamptz | |
| | | **UNIQUE(product_id, size, color)** |

> Os tamanhos e cores disponíveis de um produto são **derivados** das suas variações (não há mais arrays `sizes[]`/`colors[]` separados).

### `orders`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| code | text | código curto do pedido, **gerado automaticamente** e sequencial (ex: `#1042`) |
| customer_name | text | |
| customer_phone | text | |
| status | enum | `pending` · `completed` · `expired` · `cancelled` |
| price_type | enum | `retail` · `wholesale` |
| total | numeric | snapshot do total |
| reserved_at | timestamptz | criação/reserva |
| expires_at | timestamptz | `reserved_at` + minutos de reserva |
| completed_at | timestamptz | |
| cancelled_at | timestamptz | |
| redo_of | uuid FK → orders | preenchido se for refação de outro |
| created_at | timestamptz | |

### `order_items`
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| order_id | uuid FK → orders | |
| variant_id | uuid FK → product_variants | |
| product_id | uuid | denormalizado |
| product_code | text | snapshot |
| product_name | text | snapshot |
| size / color | text | snapshot |
| quantity | int | |
| unit_price | numeric | snapshot (preço cobrado) |
| unit_cost | numeric | **snapshot do custo** (p/ lucro histórico) |

### `stock_movements` (financeiro/movimentações)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| type | enum | `entrada` (reposição) · `saida` (venda) · `ajuste` |
| product_id / variant_id | uuid FK | |
| quantity | int | |
| unit_cost | numeric | usado em `entrada`/`ajuste` |
| unit_price | numeric | usado em `saida` |
| order_id | uuid FK → orders | preenchido quando `saida` |
| note | text | |
| created_at | timestamptz | base do filtro por mês |

### `store_settings` (linha única)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | int PK = 1 | singleton |
| store_name | text | |
| whatsapp_number | text | WhatsApp da loja |
| reservation_minutes | int | padrão **10** |
| updated_at | timestamptz | |

### Disponibilidade (calculada)
View/função `variant_availability`:

```
disponível(variação) = stock − Σ(order_items.quantity
   onde orders.status = 'pending' E orders.expires_at > now())
```

O estoque "volta" sozinho ao expirar porque a reserva deixa de contar quando `expires_at` passa — o `stock` físico só muda em **baixa** (`completed`).

## 6. Lógica de reserva (funções Postgres / RPC, `security definer`)

- **`create_order(customer, items[], price_type)`** — em transação, **trava as variações** (`SELECT ... FOR UPDATE`), confere `disponível ≥ quantidade` de cada item, cria `orders` (`pending`, `expires_at = now() + reservation_minutes`) + `order_items` (com snapshots de preço e custo). Falha com mensagem clara se faltar estoque. Garante que **o último item nunca é vendido duas vezes**.
- **`complete_order(order_id)`** — só se `status = 'pending'`. Debita `product_variants.stock` de cada item, insere `stock_movements` tipo `saida` (com `unit_price` e via `order_id`), seta `status = 'completed'`, `completed_at`.
- **`cancel_order(order_id)`** — seta `cancelled`.
- **`redo_order(order_id)`** — clona itens de um pedido `expired`/`cancelled` num novo pedido `pending` (reusa a lógica de `create_order`, com `redo_of`). Se algum item esgotou, retorna a lista de indisponíveis em vez de criar.
- **`expire_orders()`** — `UPDATE orders SET status='expired' WHERE status='pending' AND expires_at <= now()`. **Agendada via pg_cron a cada 1 min.** O painel mostra a contagem regressiva localmente; o pg_cron faz a baixa autoritativa + dispara o Realtime ("voltou pro estoque").
- **`adjust_stock(variant_id, ...)`** — ajusta `stock` e registra `stock_movements` (`entrada` com `unit_cost` para reposição, ou `ajuste` para correção).

## 7. Site público — mudanças

- Produtos vêm do Supabase (não mais de `lib/products.ts`), exibindo **código**, foto, preços (atacado/varejo), descrição.
- **Disponibilidade real por variação**: tamanho/cor esgotado fica desabilitado/"esgotado".
- **Ao enviar o pedido**: chama `create_order` (reserva) → se ok, abre o `wa.me` com o resumo (incluindo o código de cada item e o código do pedido); se algo esgotou no caminho, avisa para ajustar o carrinho. **Não abre o WhatsApp se a reserva falhar** (sem pedido fantasma).
- Carrinho permanece em `localStorage`, com a regra atacado/varejo por quantidade mínima.
- O público **nunca** vê `price_cost` nem o estoque exato — apenas disponível/esgotado (via view segura).

## 8. Painel (`/painel`)

1. **Login** — e-mail + senha (Supabase Auth). 1 acesso inicial; expansível.
2. **Pedidos** (tela principal) — lista em **tempo real**; novo pedido toca **som + pop-up**. Cada card: nome, telefone (botão WhatsApp), itens (código + produto + tamanho + cor + qtd), total e **contagem regressiva**. Ações: **Dar baixa**, **Cancelar**. Expirados marcados com **Refazer**. Filtros: pendentes/concluídos/expirados/todos.
3. **Produtos** — lista (foto, código, nome, categoria, preços, estoque total, ativo). Formulário: **código**, nome, categoria, descrição, **custo/atacado/varejo**, **qtd mín. atacado**, **upload de foto pelo celular**, e **grade de variações** (tamanho + cor + estoque). Filtro de baixo estoque/esgotado.
4. **Estoque (Inventário)** — topo com **marcadores de valores juntos**: valor total **a custo**, **a atacado**, **a varejo**, e **lucro potencial**; total de peças; nº em baixo/esgotado. Lista com **mini foto** + código + nome, estoque por variação com **marcador colorido** (🟢/🟡/🔴) e **valor em estoque** do produto. Ordenação por menor estoque/maior valor/esgotados.
5. **Financeiro / Movimentações** — **Entradas** (reposição, com valor pago) e **Saídas** (vendas, geradas ao dar baixa). **Filtro por mês**. Resumo do mês: receita · custo das vendas · **lucro bruto** · gasto com reposição. **Gráfico** simples de vendas/lucro (recharts).
6. **Configurações** — WhatsApp da loja, **minutos de reserva** (padrão 10), nome da loja.

## 9. Segurança (RLS)

- RLS habilitado em todas as tabelas.
- **anon (site público)**: SELECT apenas via view segura (produtos ativos + disponibilidade, **sem** custo/estoque exato); EXECUTE em `create_order`.
- **authenticated (dona/admin)**: acesso completo a tabelas e RPCs.
- `price_cost`, lucro e financeiro **só** para usuário logado.
- Mitigação de abuso de reserva: a auto-liberação em 10 min limita o estrago; rate-limit básico no envio. (Risco residual aceitável para o porte do negócio — registrado.)

## 10. Casos de borda

- Reservar item recém-esgotado → mensagem clara + atualizar disponibilidade.
- Dar baixa em pedido já expirado → bloqueado; usar Refazer.
- Refazer com item esgotado → informa quais itens não dão mais.
- Cliente não paga → expira em 10 min, estoque volta + aviso no painel.
- Falha de rede ao enviar → não abre WhatsApp, oferece "tentar de novo".
- Envio duplicado do mesmo carrinho → gera 2 pedidos; ela cancela o duplicado (sem dedupe automático — YAGNI).
- Fuso/relógio → tudo em `timestamptz` / `now()` do servidor.

## 11. Fases de construção

- **Fase 1 — Catálogo gerenciável.** Setup Supabase (schema base: `products`, `product_variants`, `store_settings`, Storage, Auth), migração dos 12 produtos atuais, Painel: login + **Produtos** (CRUD, incluindo a grade de variações com estoque). Site público lendo produtos/estoque reais (disponível = stock, ainda sem reserva). *Resultado: ela já alimenta o site sozinha.* (A tela dedicada de **Estoque/Inventário com marcadores de valores** entra na Fase 3.)
- **Fase 2 — Reserva e pedidos.** `orders` + `order_items` + RPCs (`create_order`, `complete_order`, `cancel_order`, `redo_order`, `expire_orders`), pg_cron, envio do site reservando estoque, tela **Pedidos** (tempo real + som/pop-up + contagem + baixa/cancelar/refazer). Disponibilidade passa a descontar reservas. *Resultado: o coração do sistema.*
- **Fase 3 — Estoque com valores e Financeiro.** `stock_movements`, **marcadores de valores** (custo/atacado/varejo + lucro potencial) na tela de Estoque, e tela **Financeiro** (movimentações, filtro por mês, lucro bruto, gráfico). *Resultado: gestão completa.*

## 12. Testes

- **Lógica de reserva (crítica)** com testes automatizados: reservar reduz disponibilidade; expirar devolve; dar baixa debita estoque e gera saída/lucro; refazer; impedir venda dupla do último item (concorrência).
- **Telas do painel**: estados de pedido, contagem regressiva, ações.
- **E2E** do fluxo principal: montar pedido → reservar → WhatsApp → dar baixa.

## 13. Fora de escopo (YAGNI por enquanto)

- Lucro líquido / cadastro de outras despesas (aluguel, frete).
- Notificações push / e-mail.
- Múltiplos papéis de usuário.
- Integração de pagamento.
- Múltiplas fotos por produto (uma foto principal por enquanto).
- Variações além de tamanho + cor.
