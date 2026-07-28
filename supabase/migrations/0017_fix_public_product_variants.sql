-- supabase/migrations/0017_fix_public_product_variants.sql
-- public_product_variants vazava estoque de TODAS as farmácias (inclusive
-- suspensas/inativas) pra qualquer visitante anônimo — a view não filtrava
-- por pharmacy.status/product.active, diferente de public_products (que já
-- filtra desde 0002). Prova: GET /rest/v1/public_product_variants?select=*
-- com a anon key retornava linhas de farmácias suspensas.
--
-- pharmacy_id é MANTIDO na view (lib/data/products.ts:21 filtra por ele ao
-- buscar as variantes de um produto) — o problema nunca foi esse campo estar
-- visível, foi a ausência do filtro de farmácia/produto ativo.
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0017_fix_public_product_variants.sql

drop view if exists public.public_product_variants;

create view public.public_product_variants with (security_invoker = false) as
  select pv.id, pv.product_id, pv.pharmacy_id, pv.size, pv.color,
         ((pv.stock - coalesce(r.reserved, 0)) > 0) as available,
         greatest(pv.stock - coalesce(r.reserved, 0), 0)::int as stock
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  join public.pharmacies ph on ph.id = pv.pharmacy_id
  left join (
    select variant_id, sum(quantity)::int as reserved
    from public.cart_reservations
    where expires_at > now()
    group by variant_id
  ) r on r.variant_id = pv.id
  where p.active = true and ph.status = 'active';

grant select on public.public_product_variants to anon;
