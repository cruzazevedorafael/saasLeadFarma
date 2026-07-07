-- supabase/migrations/0007_formas_envio.sql
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shipping_methods enable row level security;
create policy "admin all shipping" on public.shipping_methods
  for all to authenticated using (true) with check (true);
create policy "anon read shipping" on public.shipping_methods
  for select to anon using (active);
