-- 0013 — Cache de consultas por código de barras (EAN/GTIN).
-- Dados públicos de produto (não é dado de tenant). Só o servidor (service_role)
-- lê/escreve; anon/authenticated não têm acesso. Consulta 1x por EAN, serve sempre.
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0013_gtin_cache.sql

create table if not exists public.gtin_cache (
  gtin text primary key,
  name text,
  brand text,
  category text,
  image_url text,
  source text,           -- 'cosmos' | 'off' | 'obf' | 'cmed' | 'nao_encontrado'
  pmc numeric,           -- preço máximo ao consumidor (medicamento/CMED), se houver
  fetched_at timestamptz not null default now()
);

alter table public.gtin_cache enable row level security;
-- sem policies → anon/authenticated não acessam; service_role (servidor) bypassa.
revoke all on public.gtin_cache from anon, authenticated;

notify pgrst, 'reload schema';
