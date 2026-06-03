-- ============================================================
-- KAROLLA FIT — APLICAR TUDO DE UMA VEZ NO SUPABASE
-- Cole este conteúdo inteiro no SQL Editor do Supabase e clique em RUN.
-- (equivale às migrations 0005, 0006, 0007, 0008 e 0009 na ordem)
-- ATENÇÃO: a primeira parte APAGA os produtos de exemplo (era o combinado).
-- ============================================================

-- ---------- 0005: peso + limpeza dos dados de exemplo ----------
alter table public.products
  add column weight_grams int not null default 0;

alter table public.order_items
  add column weight_grams int not null default 0;

create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams
  from public.products
  where active = true;

delete from public.product_variants;
delete from public.products;

-- ---------- 0006: categorias ----------
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

-- ---------- 0007: formas de envio ----------
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

-- ---------- 0008: formas de pagamento ----------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surcharge_percent numeric(5,2) not null default 0,
  surcharge_fixed numeric(10,2) not null default 0,
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

-- ---------- 0009: colunas de envio/pagamento no pedido ----------
alter table public.orders
  add column items_subtotal numeric(10,2) not null default 0,
  add column shipping_label text not null default '',
  add column shipping_price numeric(10,2) not null default 0,
  add column payment_label text not null default '',
  add column payment_surcharge numeric(10,2) not null default 0;

-- ---------- 0012: várias fotos + estoque real nas views ----------
alter table public.products
  add column image_urls text[] not null default '{}';

create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams, image_urls
  from public.products
  where active = true;

create or replace view public.public_product_variants
  with (security_invoker = false) as
  select id, product_id, size, color, stock, (stock > 0) as available
  from public.product_variants;

grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;

-- ============================================================
-- FIM. Se rodou sem erro, está tudo pronto. Pode mergear o PR.
-- ============================================================
