# Spec — Painel de catálogo, peso, envio/pagamento e checkout detalhado

**Data:** 2026-06-01
**Branch:** feat/painel-fase-1
**Status:** aprovado para implementação

## Objetivo

Deixar o sistema da KAROLLA FIT pronto para a loja montar o catálogo do zero e
fechar pedidos completos pelo celular:

1. Vitrine "limpa": quando um produto tem só 1 cor (ou 1 tamanho), mostrar como
   texto fixo em vez de botão de seleção.
2. Categorias gerenciadas pelo admin (criar / renomear / apagar).
3. Peso (gramas) por produto, somado no pedido para a loja cotar frete.
4. Formas de **envio** criadas no painel, com preço de frete.
5. Formas de **pagamento** criadas no painel, com acréscimo (% e/ou valor fixo).
6. Cliente escolhe envio e pagamento no carrinho; valores entram no total.
7. Pedido chega no WhatsApp bem detalhado para separação.
8. Tudo responsivo, rápido e prático no celular.

O fluxo de baixa de estoque (admin aceita o pedido e desconta o estoque) **não muda**.

## Decisões tomadas (com o usuário)

- **Vitrine:** 1 opção → texto ("Cor: Preto"); 2+ opções → botões.
- **Categorias:** lista gerenciada; produto guarda o **nome** da categoria como
  texto (não FK) para não mexer em views/mappers existentes.
- **Apagar categoria em uso:** bloqueia com aviso.
- **Dados de exemplo:** apagar todos os produtos/variações de exemplo e começar
  limpo. Pedidos antigos não são tocados.
- **Número do produto:** reaproveitar o campo `code` existente, renomeado na UI
  para "Número/Código" (único, aceita número ou texto).
- **Peso:** um valor por produto (não por tamanho).
- **Peso total:** exibido no painel de Pedidos.
- **Envio e pagamento:** criados pelo admin no painel; cliente escolhe no checkout.
- **Escolha de envio/pagamento:** opcional para enviar; se não escolher → "A combinar".

## Banco de dados

Migrations novas (as antigas não são alteradas):

### 0005 — peso + limpeza
- `alter table products add column weight_grams int not null default 0`
- `alter table order_items add column weight_grams int not null default 0`
- `delete from product_variants;` e `delete from products;`
  (seguro: `order_items.product_id` NÃO tem FK; pedidos antigos mantêm o snapshot.)

### 0006 — categorias
```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "admin all categories" on public.categories
  for all to authenticated using (true) with check (true);
```
Começa vazia (o usuário cria as próprias).

### 0007 — formas de envio
```sql
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shipping_methods enable row level security;
create policy "admin all shipping" on public.shipping_methods
  for all to authenticated using (true) with check (true);
create policy "anon read shipping" on public.shipping_methods
  for select to anon using (active);
```
O cliente (anon) precisa ler as ativas para escolher no carrinho.

### 0008 — formas de pagamento
```sql
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surcharge_percent numeric(5,2) not null default 0,  -- ex: 5.00 = +5%
  surcharge_fixed numeric(10,2) not null default 0,    -- ex: 2.00 = +R$2
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_methods enable row level security;
create policy "admin all payment" on public.payment_methods
  for all to authenticated using (true) with check (true);
create policy "anon read payment" on public.payment_methods
  for select to anon using (active);
```

### 0009 — colunas no pedido
```sql
alter table public.orders
  add column items_subtotal numeric(10,2) not null default 0,
  add column shipping_label text not null default '',
  add column shipping_price numeric(10,2) not null default 0,
  add column payment_label text not null default '',
  add column payment_surcharge numeric(10,2) not null default 0;
```
`total` passa a ser o **total final** (subtotal + frete + acréscimo).

## Regra do total (calculada no servidor)

```
items_subtotal   = soma(unit_price * qtd)   -- já com varejo/atacado
shipping_price   = preço da forma de envio escolhida (0 se nenhuma)
base_surcharge   = items_subtotal + shipping_price
payment_surcharge = base_surcharge * (surcharge_percent/100) + surcharge_fixed
total            = items_subtotal + shipping_price + payment_surcharge
weight_total_g   = soma(weight_grams * qtd)
```

- Os preços de envio e os acréscimos são **relidos do banco** dentro de
  `criarPedido` a partir dos IDs enviados pelo cliente — nunca confiando nos
  valores que vêm do navegador.
- Acréscimo arredondado a 2 casas.
- Se o cliente não escolher envio/pagamento: labels ficam "A combinar",
  valores ficam 0.

## Camada de dados (lib/data)

- `types.ts`: `Product` ganha `weightGrams: number`.
- `mappers.ts`: `mapProductRow` lê `weight_grams`.
- `orders.types.ts`: `OrderItem` ganha `weightGrams`; `OrderWithItems` ganha
  `itemsSubtotal`, `shippingLabel`, `shippingPrice`, `paymentLabel`,
  `paymentSurcharge`, e um getter/serviço para `weightTotalGrams`.
- `order.helpers.ts` (`buildOrder`): recebe `shipping` e `payment` resolvidos,
  inclui `weight_grams` em cada item, calcula `items_subtotal`,
  `payment_surcharge` e `total` pela regra acima.
- Novos módulos:
  - `lib/data/categories.ts` — `getCategories()` (admin).
  - `lib/data/shipping.ts` — `getShippingMethods(activeOnly?)`.
  - `lib/data/payment.ts` — `getPaymentMethods(activeOnly?)`.
- Helper puro `lib/data/products.helpers.ts`:
  `shouldRenderAsButtons(values: string[]): boolean` (true se length >= 2) —
  testável e usado pela vitrine.

## Front-end público

### `components/product-card.tsx`
- `sizes.length >= 2` → botões (como hoje); senão → texto "Tamanho: X".
- `colors.length >= 2` → botões; senão → texto "Cor: X".
- O valor único continua selecionado por baixo para o "adicionar ao carrinho".

### `components/cart.tsx` (checkout)
- Após Nome e Telefone, dois seletores: **Forma de envio** e **Forma de pagamento**
  (carregados via props a partir do servidor, só os ativos).
- Resumo mostra: Subtotal, Frete, Acréscimo, **Total** — atualizando ao escolher.
- `criarPedido` recebe `shippingMethodId?` e `paymentMethodId?`.
- Mensagem do WhatsApp detalhada: cabeçalho com nº do pedido; itens
  (nº/código, nome, tamanho, cor, qtd, subtotal); **peso total**; envio + frete;
  pagamento + acréscimo; total final; dados do cliente.
- Envio/pagamento são opcionais para mandar.

### `app/page.tsx`
- Passa as formas de envio/pagamento ativas para o `Catalog` → `Cart`.

## Painel do admin

Novos links na home (`app/painel/page.tsx`): Categorias, Envio, Pagamento.

### `/painel/categorias`
- Lista + criar + renomear + apagar.
- Apagar bloqueado se houver produto com aquele nome (conta produtos; mostra aviso).
- Renomear atualiza `products.category` de todos os produtos com o nome antigo.

### `/painel/envio`
- CRUD de `shipping_methods` (nome, preço, ativo).

### `/painel/pagamento`
- CRUD de `payment_methods` (nome, % de acréscimo, valor fixo, ativo).

### `/painel/produtos`
- Form: campo **Peso (g)**; categoria vira **dropdown** (categorias + "Sem categoria");
  label do código vira "Número/Código".
- Lista: tabela no desktop, **cards** no celular.

### `/painel/pedidos`
- Cada card mostra peso total, envio + frete, pagamento + acréscimo, total final.
- Fluxo de aceitar/baixar estoque inalterado (`complete_order`).

## Mobile-first

- Telas de cadastro/gerência em coluna única no celular, inputs com altura
  confortável para toque, botões de ação grandes.
- Lista de produtos responsiva (cards no mobile).
- Componentes leves; nada de dependência nova pesada.

## Validação (Zod)

- `produtoSchema`: + `weightGrams` (int >= 0), `category` opcional (string).
- `categoriaSchema`: `name` obrigatório, único (validado na action).
- `shippingSchema`/`paymentSchema`: nome obrigatório; preço/acréscimos >= 0.

## Testes

- `products.helpers.test.ts`: `shouldRenderAsButtons`.
- `order.helpers.test.ts`: peso total; total com frete; acréscimo % e fixo;
  sem envio/pagamento (zeros).
- Actions de categoria: renomear propaga; apagar bloqueia quando em uso
  (teste de unidade da lógica de contagem).

## Fora de escopo (YAGNI)

- Reordenar categorias/métodos por arrasto (ordem segue criação).
- Frete calculado automaticamente por CEP/peso (a loja cota manualmente com o peso).
- Peso por tamanho.
- Gateway de pagamento online (pagamento é combinado por fora; baixa é manual).

## Ordem de implementação sugerida

1. Migrations 0005–0009.
2. Camada de dados (types/mappers/helpers/módulos novos) + testes de helpers.
3. Vitrine limpa (product-card) + teste.
4. Telas admin: categorias, envio, pagamento.
5. Produto: peso + dropdown de categoria + label + lista responsiva.
6. Checkout: seletores, total, mensagem detalhada, `buildOrder`/`criarPedido`.
7. Pedidos: exibir peso/envio/pagamento/total.
8. Passada de responsividade no celular.
