# 02 · Banco de dados

Banco: **Supabase (Postgres)**, projeto `emfraxjwxkvaxnvkubpz`. Schema versionado em `supabase/migrations/`:
- `0001_pharmacies_profiles.sql` — tenant, papéis, helpers e RLS da fundação.
- `0002_catalog_e_negocio_tenant.sql` — tabelas de negócio (tenant-izadas), views públicas e funções de pedido/reserva.
- `0003_produto_farmacia.sql` — **Fase 1**: `products.brand`/`requires_prescription`, view `public_products` atualizada, bucket de storage `produtos`.
- `0004_clientes_lgpd.sql` — **Fase 2**: tabelas `customers`/`customer_history`, snapshot de cliente em `orders`, RPCs `upsert_customer`/`increment_customer_orders`.
- `0005_planos_assinaturas.sql` — **Fase 5**: colunas de plano/assinatura/ASAAS em `pharmacies`.
- `_karolla_archive/` — as 16 migrations do app original (Karolla), fora do caminho de aplicação, só referência histórica.

> Aplicação: `node scripts/seed-fase0.mjs` (schema base, idempotente) para o schema 0001/0002; migrations posteriores (0003+) via `node scripts/apply-migration.mjs supabase/migrations/000X_arquivo.sql` (reutilizável, aplica um ou mais arquivos pela Management API). Ver [05 · Setup](./05-SETUP-E-EXECUCAO.md).

## Tabelas de plataforma

### `pharmacies` — o tenant (uma linha por farmácia)
Substitui o antigo `store_settings` singleton. Guarda cadastro legal (usado nos comprovantes da Fase 3), marca visível ao cliente, config de operação e plano/assinatura (Fase 5).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text **unique** | usado na URL do catálogo `/f/[slug]` |
| `razao_social`, `nome_fantasia`, `cnpj` | text | cadastro (obrigatórios no onboarding) |
| `cep, logradouro, numero, bairro, cidade, uf` | text | endereço |
| `telefone, email` | text | contato |
| `farmaceutico_responsavel, crf` | text | responsável técnico |
| `logo_url`, `nome_exibicao` | text | **marca que o cliente vê** |
| `whatsapp_number` | text | número que recebe os pedidos |
| `banner_image_url` | text | banner do catálogo |
| `wholesale_threshold` | int (def. 4) | limite de qtd que ativa o "preço por quantidade" (rótulo de farmácia sobre a mecânica de atacado) |
| `status` | text | `active` \| `suspended` |
| `onboarding_completed` | bool | gate de cadastro |
| `plan` | text (def. `trial`) | **Fase 5** — `trial` \| `basic` \| `pro` |
| `subscription_status` | text (def. `trialing`) | **Fase 5** — `trialing` \| `active` \| `past_due` \| `canceled` |
| `trial_ends_at` | timestamptz | **Fase 5** — fim do período de teste (auto-cadastro: 14 dias) |
| `asaas_customer_id` | text | **Fase 5** — id do cliente no ASAAS (preenchido na 1ª cobrança) |
| `asaas_subscription_id` | text | **Fase 5** — id da assinatura no ASAAS |
| `created_at, updated_at` | timestamptz | |

### `profiles` — liga usuário ↔ farmácia ↔ papel
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` (Supabase Auth) |
| `pharmacy_id` | uuid FK → pharmacies | `null` para super-admin |
| `role` | text | `superadmin` \| `pharmacy_admin` |
| `created_at` | timestamptz | |

## Tabelas de negócio (todas com `pharmacy_id NOT NULL`)

### `products` — produto de farmácia (Fase 1)
Herdou a forma do app original (variações, atacado/varejo) e ganhou os campos de farmácia na Fase 1. Colunas:
- `code` — EAN/código, opcional, **único por farmácia** quando preenchido.
- `name`, `category`, `description`, `image_url`, `image_urls text[]` (até 5 fotos).
- **`brand`** — marca/laboratório (texto livre; UI mostra `Marca / Laboratório`). *Nova na Fase 1.*
- **`requires_prescription`** — booleano; UI mostra selo "Exige receita" no catálogo. *Nova na Fase 1.*
- `price_cost` — custo (nunca exposto ao público).
- `price_retail` — **"Preço unitário"** na UI.
- `price_wholesale` — **"Preço por quantidade"** na UI; entra a partir de `min_wholesale` unidades **ou** do `wholesale_threshold` da farmácia (mesma mecânica herdada de atacado, com rótulo de farmácia).
- `min_wholesale`, `counts_for_wholesale`, `weight_grams`, `on_promo`, `promo_price`, `active`, `sort_order`.

> **Nota de nomenclatura:** a Fase 1 **não renomeou** colunas físicas para não quebrar pedidos/relatórios já existentes — a semântica de farmácia vive nos **rótulos das telas** (`app/painel/produtos/_components/produto-form.tsx`, `components/product-card.tsx`), não no schema.

### `product_variants` — "apresentação/dosagem" na UI (Fase 1)
- `product_id` FK, **`size`** (rotulado **Apresentação**, ex. "Caixa 20 comp."), **`color`** (rotulado **Dosagem**, ex. "500 mg"), `stock`.
- As colunas físicas continuam `size`/`color` — só o rótulo mudou (mesma nota acima).

### Demais tabelas de negócio (inalteradas desde a Fase 0)
- **`categories`** — `name` (**único por farmácia**), `sort_order`.
- **`shipping_methods`** — `name`, `price`, `active`, `sort_order`.
- **`payment_methods`** — `name`, `surcharge_percent`, `surcharge_fixed`, `active`, `sort_order`.
- **`cart_reservations`** — reserva de estoque no carrinho (trava 30 min). **Ainda ativa** — a remoção prevista para a Fase 2 foi **adiada** (ver [06](./06-MANUTENCAO-E-ROADMAP.md)).

### `orders` — pedido (ganhou snapshot do cliente na Fase 2)
- `number` (sequência global `order_number_seq`), `customer_name`, `customer_phone`, `status` (`pending`/`completed`/`cancelled`), `price_type`, `items_subtotal`, `shipping_*`, `payment_*`, `total`, `stock_warning`, timestamps.
- **Snapshot do cliente no momento do pedido** (gravado sempre, independente de consentimento LGPD) — *novas na Fase 2*:
  `customer_id` (FK → `customers`, `on delete set null`, só setado se houve consentimento), `customer_cpf`, `customer_cep`, `customer_logradouro`, `customer_numero`, `customer_complemento`, `customer_bairro`, `customer_cidade`, `customer_uf`.

### `order_items` — inalterada
`order_id` FK, `product_id`, `variant_id`, snapshots (`product_code`, `product_name`, `size`, `color`), `quantity`, `unit_price`, `unit_cost`, `weight_grams`.

### `customers` — cadastro atual do cliente por farmácia (Fase 2)
Uma linha por CPF **por farmácia** (`unique (pharmacy_id, cpf)`). Só é gravada/atualizada **com consentimento LGPD**.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `pharmacy_id` | uuid FK → pharmacies | tenant |
| `cpf` | text | só dígitos |
| `name`, `phone` | text | |
| `cep, logradouro, numero, complemento, bairro, cidade, uf` | text | endereço |
| `lgpd_consent` | bool | |
| `lgpd_consent_at` | timestamptz | gravado na primeira vez que o cliente autorizou |
| `orders_count` | int | incrementado a cada pedido (`increment_customer_orders`) |
| `created_at, updated_at` | timestamptz | |

### `customer_history` — versões antigas do cadastro (Fase 2)
Uma linha é gravada **antes** de cada alteração de cadastro (nome/telefone/endereço mudou desde o último pedido).

| Coluna | Tipo |
|---|---|
| `id`, `pharmacy_id`, `customer_id` (FK → customers, `on delete cascade`) | uuid |
| `name`, `phone`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf` | text — snapshot do dado **anterior** à mudança |
| `created_at` | timestamptz |

## Isolamento (RLS) — o coração do multi-tenant

Duas funções `security definer` (rodam com privilégio elevado, lendo `profiles` sem esbarrar no RLS):

```sql
current_pharmacy_id() -> uuid      -- id da farmácia do usuário logado (auth.uid())
is_superadmin()       -> boolean   -- true se o profile é superadmin
```

**Política padrão** em cada tabela de negócio (ex.: `products`, `customers`, `customer_history`):
```sql
create policy "products tenant all" on public.products for all to authenticated
  using      (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
```
→ uma farmácia só lê/escreve as próprias linhas; o super-admin acessa tudo. `customers`/`customer_history` seguem exatamente essa política (Fase 2).

**`pharmacies`/`profiles`:** super-admin faz tudo; a farmácia lê/edita só a própria linha; o anônimo lê dados públicos de farmácias `active` (para o catálogo).

**Anon (catálogo público):** lê pelas **views** e por políticas `anon read` em `shipping_methods`/`payment_methods` (só linhas `active` de farmácias `active`). O checkout anônimo **não lê `customers` diretamente** — passa pelas RPCs `upsert_customer`/`increment_customer_orders` (via `service_role`, chamadas por server actions) e por `buscarClientePorCpf` (`app/_actions/buscar-cliente.ts`, também `service_role`).

### Views públicas (rodam como dono, expõem o slug)
- **`public_products`** — produtos `active` de farmácias `active`, com `pharmacy_id` e `slug`; expõe `brand` e `requires_prescription` (Fase 1); **não expõe custo**.
- **`public_product_variants`** — variações com `available` e `stock` **já descontadas as reservas de carrinho ativas**.

## Storage

- **Bucket `produtos`** (público) — fotos de produto/banner. Criado pela migration `0003_produto_farmacia.sql`. Leitura pública (`storage.objects` policy `produtos public read`); upload só por usuário autenticado (`produtos authenticated write`), feito pela server action de upload do painel.

## Funções (RPC)

### `security definer`, só `service_role` (herdadas da Fase 0)
- `reserve_order(order_id)` — desconta o estoque dos itens do pedido (pode ficar negativo; não bloqueia).
- `complete_order(order_id)` — confirma a venda (pedido `pending` → `completed`).
- `cancel_order(order_id)` — devolve o estoque e marca `cancelled`.
- `reservar_item / liberar_item / liberar_carrinho` — reserva de estoque no carrinho por 30 min (**ainda ativa**, ver dívida acima).

### Novas na Fase 2 (`security definer`, só `service_role`)
- **`upsert_customer(p_pharmacy_id, p_cpf, p_name, p_phone, p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf, p_consent) -> uuid`** — grava ou atualiza o cliente daquela farmácia+CPF; se algum campo de cadastro mudou, **versiona o dado antigo** em `customer_history` antes de sobrescrever; registra `lgpd_consent_at` na primeira vez que `p_consent = true`. Chamada por `app/_actions/criar-pedido.ts` só quando o checkout teve consentimento LGPD.
- **`increment_customer_orders(p_customer_id) -> void`** — incrementa `customers.orders_count` de forma atômica.

> As RPCs operam por `order_id`/`variant_id`/`customer_id` (que já pertencem a uma farmácia). As server actions do painel/checkout ainda **conferem a posse** (`pharmacy_id`) antes de chamá-las.
