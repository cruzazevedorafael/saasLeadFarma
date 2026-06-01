-- supabase/migrations/0008_formas_pagamento.sql
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  surcharge_percent numeric(5,2) not null default 0,
  surcharge_fixed numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_methods enable row level security;
create policy "admin all payment" on public.payment_methods
  for all to authenticated using (true) with check (true);
create policy "anon read payment" on public.payment_methods
  for select to anon using (active);
