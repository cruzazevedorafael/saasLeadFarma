-- 0003_produto_farmacia.sql — Fase 1: reshape do produto para farmácia.
-- Idempotente (pode rodar mais de uma vez sem erro).
--
-- Decisões:
--  * As "variações" (antes tamanho/cor) passam a representar APRESENTAÇÃO/DOSAGEM
--    no nível de UI. As colunas físicas continuam `size`/`color` (atributo 1/2)
--    para não quebrar pedidos/relatórios já existentes — a semântica de farmácia
--    vive nos rótulos das telas.
--  * Preço unitário = price_retail; preço "a partir de N unidades" = price_wholesale
--    com o limite em pharmacies.wholesale_threshold. (mesma mecânica, rótulo novo)
--  * NOVOS dados de farmácia entram como colunas de verdade:
--      products.brand                (marca / laboratório)
--      products.requires_prescription (exige receita)

-- ============================================================
-- NOVAS COLUNAS DE PRODUTO
-- ============================================================
alter table public.products add column if not exists brand text not null default '';
alter table public.products add column if not exists requires_prescription boolean not null default false;

-- ============================================================
-- VIEW PÚBLICA — expor os novos campos ao catálogo
-- (drop + create porque a ordem das colunas muda; replace não reordena)
-- ============================================================
drop view if exists public.public_products;
create view public.public_products with (security_invoker = false) as
  select p.id, p.pharmacy_id, ph.slug,
         p.code, p.name, p.brand, p.category, p.description, p.image_url, p.image_urls,
         p.requires_prescription,
         p.price_wholesale, p.price_retail, p.min_wholesale, p.sort_order,
         p.counts_for_wholesale, p.weight_grams, p.on_promo, p.promo_price
  from public.products p
  join public.pharmacies ph on ph.id = p.pharmacy_id
  where p.active = true and ph.status = 'active';

grant select on public.public_products to anon;

-- ============================================================
-- STORAGE — bucket público de fotos de produto/banner
-- Uploads são feitos pelo service_role (bypassa RLS); leitura é pública.
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('produtos', 'produtos', true)
  on conflict (id) do update set public = true;

drop policy if exists "produtos public read" on storage.objects;
create policy "produtos public read" on storage.objects
  for select to public using (bucket_id = 'produtos');

drop policy if exists "produtos authenticated write" on storage.objects;
create policy "produtos authenticated write" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos');
