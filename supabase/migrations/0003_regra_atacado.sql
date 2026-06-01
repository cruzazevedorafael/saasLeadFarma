-- supabase/migrations/0003_regra_atacado.sql

-- flag por produto: conta (ou não) para atingir o atacado
alter table public.products
  add column counts_for_wholesale boolean not null default true;

-- limite global de peças para o carrinho virar atacado
alter table public.store_settings
  add column wholesale_threshold int not null default 4;

-- recriar a view pública expondo counts_for_wholesale (append no fim das colunas)
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale
  from public.products
  where active = true;
