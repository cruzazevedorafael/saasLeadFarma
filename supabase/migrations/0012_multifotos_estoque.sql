-- supabase/migrations/0012_multifotos_estoque.sql

-- 1) Várias fotos por produto (a 1ª continua espelhada em image_url = capa)
alter table public.products
  add column image_urls text[] not null default '{}';

-- 2) View pública de produtos: expõe image_urls (append no fim das colunas)
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams, image_urls
  from public.products
  where active = true;

-- 3) View pública de variações: expõe o estoque real (mantém available por segurança)
create or replace view public.public_product_variants
  with (security_invoker = false) as
  select id, product_id, size, color, stock, (stock > 0) as available
  from public.product_variants;

grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;
