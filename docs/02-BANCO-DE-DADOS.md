# 02 · Banco de dados

Banco: **Supabase (Postgres)**, projeto `emfraxjwxkvaxnvkubpz`. Schema versionado em `supabase/migrations/`:
- `0001_pharmacies_profiles.sql` — tenant, papéis, helpers e RLS da fundação.
- `0002_catalog_e_negocio_tenant.sql` — tabelas de negócio (tenant-izadas), views públicas e funções de pedido/reserva.
- `_karolla_archive/` — as 16 migrations do app original (Karolla), fora do caminho de aplicação, só referência histórica.

> Aplicação e seed: `node scripts/seed-fase0.mjs` (idempotente). Ver [05 · Setup](./05-SETUP-E-EXECUCAO.md).

## Tabelas de plataforma

### `pharmacies` — o tenant (uma linha por farmácia)
Substitui o antigo `store_settings` singleton. Guarda cadastro legal (também usado nos comprovantes da Fase 3), marca visível ao cliente e config de operação.

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
| `wholesale_threshold` | int (def. 4) | herdado da regra atacado (revisto na Fase 1/2) |
| `status` | text | `active` \| `suspended` |
| `onboarding_completed` | bool | gate de cadastro |
| `created_at, updated_at` | timestamptz | |

### `profiles` — liga usuário ↔ farmácia ↔ papel
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` (Supabase Auth) |
| `pharmacy_id` | uuid FK → pharmacies | `null` para super-admin |
| `role` | text | `superadmin` \| `pharmacy_admin` |
| `created_at` | timestamptz | |

## Tabelas de negócio (todas com `pharmacy_id NOT NULL`)

Herdaram a forma do app original e ganharam `pharmacy_id` (FK → pharmacies, `on delete cascade`). O **reshape para farmácia** (produto) é a Fase 1.

- **`products`** — `code` (EAN/código, opcional, **único por farmácia** quando preenchido), `name`, `category`, `description`, `image_url`, `image_urls text[]`, `price_cost`, `price_wholesale`, `price_retail`, `min_wholesale`, `counts_for_wholesale`, `weight_grams`, `on_promo`, `promo_price`, `active`, `sort_order`.
- **`product_variants`** — `product_id` FK, `size`, `color`, `stock`. (Vira "apresentação/dosagem" na Fase 1.)
- **`categories`** — `name` (**único por farmácia**), `sort_order`.
- **`shipping_methods`** — `name`, `price`, `active`, `sort_order`.
- **`payment_methods`** — `name`, `surcharge_percent`, `surcharge_fixed`, `active`, `sort_order`.
- **`orders`** — `number` (sequência global `order_number_seq`), `customer_name`, `customer_phone`, `status` (`pending`/`completed`/`cancelled`), `price_type`, `items_subtotal`, `shipping_*`, `payment_*`, `total`, `stock_warning`, timestamps.
- **`order_items`** — `order_id` FK, `product_id`, `variant_id`, snapshots (`product_code`, `product_name`, `size`, `color`), `quantity`, `unit_price`, `unit_cost`, `weight_grams`.
- **`cart_reservations`** — reserva de estoque no carrinho (trava 30 min). Mantida na Fase 0, **será removida na Fase 2**.

## Isolamento (RLS) — o coração do multi-tenant

Duas funções `security definer` (rodam com privilégio elevado, lendo `profiles` sem esbarrar no RLS):

```sql
current_pharmacy_id() -> uuid      -- id da farmácia do usuário logado (auth.uid())
is_superadmin()       -> boolean   -- true se o profile é superadmin
```

**Política padrão** em cada tabela de negócio (ex.: `products`):
```sql
create policy "products tenant all" on public.products for all to authenticated
  using      (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
```
→ uma farmácia só lê/escreve as próprias linhas; o super-admin acessa tudo.

**`pharmacies`/`profiles`:** super-admin faz tudo; a farmácia lê/edita só a própria linha; o anônimo lê dados públicos de farmácias `active` (para o catálogo).

**Anon (catálogo público):** lê pelas **views** e por políticas `anon read` em `shipping_methods`/`payment_methods` (só linhas `active` de farmácias `active`).

### Views públicas (rodam como dono, expõem o slug)
- **`public_products`** — produtos `active` de farmácias `active`, com `pharmacy_id` e `slug`; **não expõe custo**.
- **`public_product_variants`** — variações com `available` e `stock` **já descontadas as reservas de carrinho ativas**.

## Funções (RPC, `security definer`, só `service_role`)
- `reserve_order(order_id)` — desconta o estoque dos itens do pedido (pode ficar negativo; não bloqueia).
- `complete_order(order_id)` — confirma a venda (pedido `pending` → `completed`).
- `cancel_order(order_id)` — devolve o estoque e marca `cancelled`.
- `reservar_item / liberar_item / liberar_carrinho` — reserva de estoque no carrinho por 30 min (removidas na Fase 2).

> As RPCs operam por `order_id`/`variant_id` (que já pertencem a uma farmácia). As server actions do painel ainda **conferem a posse** (`pharmacy_id`) antes de chamá-las.
