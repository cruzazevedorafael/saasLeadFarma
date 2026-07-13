-- 0012 — Fonte do catálogo por farmácia (white-label). Legível pelo anon (não é PII).
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0012_catalog_font.sql

alter table public.pharmacies add column if not exists catalog_font text;

-- anon do catálogo lê a coluna (o grant de colunas do anon foi definido em 0006).
grant select (catalog_font) on public.pharmacies to anon;

notify pgrst, 'reload schema';
