-- supabase/migrations/0005_peso_e_limpeza.sql

-- peso por produto (gramas) e snapshot no item do pedido
alter table public.products
  add column weight_grams int not null default 0;

alter table public.order_items
  add column weight_grams int not null default 0;

-- expor weight_grams na view pública (recriar mantendo as colunas existentes)
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams
  from public.products
  where active = true;

-- limpeza dos dados de exemplo (pedidos antigos NÃO são afetados:
-- order_items.product_id não tem FK e mantém o snapshot)
delete from public.product_variants;
delete from public.products;
