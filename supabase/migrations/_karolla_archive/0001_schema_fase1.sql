-- supabase/migrations/0001_schema_fase1.sql

-- PRODUTOS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default '',
  description text not null default '',
  image_url text,
  price_cost numeric(10,2) not null default 0,
  price_wholesale numeric(10,2) not null default 0,
  price_retail numeric(10,2) not null default 0,
  min_wholesale int not null default 1,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- VARIAÇÕES (tamanho + cor)
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  stock int not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);

-- CONFIGURAÇÕES DA LOJA (linha única)
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'Karolla Fit',
  whatsapp_number text not null default '',
  reservation_minutes int not null default 10,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- VIEW PÚBLICA SEGURA (sem custo; expõe disponibilidade = estoque na Fase 1)
-- security_invoker = false: a view roda com privilégios do dono (postgres),
-- então o anon lê pelas views sem precisar de policy nas tabelas base (e o RLS
-- das tabelas base continua protegendo acesso direto / colunas sensíveis).
create view public.public_product_variants
  with (security_invoker = false) as
  select id, product_id, size, color, (stock > 0) as available
  from public.product_variants;

create view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order
  from public.products
  where active = true;

-- RLS
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_settings enable row level security;

-- Autenticado (admin) faz tudo
create policy "admin all products" on public.products
  for all to authenticated using (true) with check (true);
create policy "admin all variants" on public.product_variants
  for all to authenticated using (true) with check (true);
create policy "admin all settings" on public.store_settings
  for all to authenticated using (true) with check (true);

-- Anon pode ler settings (precisa do whatsapp/nome no site)
create policy "anon read settings" on public.store_settings
  for select to anon using (true);

-- Anon precisa de SELECT nas views para consultá-las (as views rodam como dono).
grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;
