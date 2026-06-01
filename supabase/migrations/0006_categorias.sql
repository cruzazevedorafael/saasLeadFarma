-- supabase/migrations/0006_categorias.sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories enable row level security;
create policy "admin all categories" on public.categories
  for all to authenticated using (true) with check (true);
