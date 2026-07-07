-- supabase/migrations/0013_promocao.sql

-- 1) Promoção por produto: flag + preço promocional
alter table public.products
  add column if not exists on_promo boolean not null default false;
alter table public.products
  add column if not exists promo_price numeric;

-- 2) View pública de produtos: repete as colunas atuais na mesma ordem e
-- acrescenta on_promo/promo_price no FIM (create or replace view só permite
-- acrescentar colunas no final).
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams, image_urls,
         on_promo, promo_price
  from public.products
  where active = true;

grant select on public.public_products to anon;
