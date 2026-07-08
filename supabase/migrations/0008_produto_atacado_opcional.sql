-- 0008_produto_atacado_opcional.sql — atacado (preço por quantidade) opcional por produto.
-- has_wholesale = false → o produto vende SEMPRE no preço unitário e não conta pro atacado.
alter table public.products add column if not exists has_wholesale boolean not null default true;

-- expõe o campo no catálogo (a regra de preço roda no cliente com os dados da view)
drop view if exists public.public_products;
create view public.public_products with (security_invoker = false) as
  select p.id, p.pharmacy_id, ph.slug,
         p.code, p.name, p.brand, p.category, p.description, p.image_url, p.image_urls,
         p.requires_prescription, p.has_wholesale,
         p.price_wholesale, p.price_retail, p.min_wholesale, p.sort_order,
         p.counts_for_wholesale, p.weight_grams, p.on_promo, p.promo_price
  from public.products p
  join public.pharmacies ph on ph.id = p.pharmacy_id
  where p.active = true and ph.status = 'active';
grant select on public.public_products to anon;
