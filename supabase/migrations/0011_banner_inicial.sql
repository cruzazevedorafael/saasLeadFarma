-- supabase/migrations/0011_banner_inicial.sql
-- Imagem de banner da página inicial (faixa abaixo do logo).
-- Vazio = não mostra nada.

alter table public.store_settings
  add column banner_image_url text not null default '';
