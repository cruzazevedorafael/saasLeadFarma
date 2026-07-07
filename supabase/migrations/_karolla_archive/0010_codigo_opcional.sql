-- supabase/migrations/0010_codigo_opcional.sql
-- Código do produto agora é OPCIONAL: pode ficar em branco (null).
-- Continua único, mas só quando preenchido (dois produtos sem código são permitidos).

alter table public.products
  alter column code drop not null;

alter table public.products
  drop constraint if exists products_code_key;

create unique index if not exists products_code_unique
  on public.products (code)
  where code is not null and code <> '';
