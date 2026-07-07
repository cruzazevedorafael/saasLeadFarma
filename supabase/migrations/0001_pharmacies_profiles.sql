-- 0001_pharmacies_profiles.sql — Fundação multi-tenant LeadFarma
-- Cria o tenant (pharmacies), o vínculo usuário↔farmácia↔papel (profiles)
-- e os helpers de isolamento (RLS).

-- ============================================================
-- TENANT: farmácia
-- ============================================================
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  -- cadastro legal (obrigatório no onboarding; alimenta comprovantes na Fase 3)
  razao_social text,
  nome_fantasia text,
  cnpj text,
  cep text,
  logradouro text,
  numero text,
  bairro text,
  cidade text,
  uf text,
  telefone text,
  email text,
  farmaceutico_responsavel text,
  crf text,
  -- marca visível ao cliente
  logo_url text,
  nome_exibicao text,
  -- operação
  whatsapp_number text not null default '',
  banner_image_url text,
  wholesale_threshold int not null default 4,
  -- plataforma
  status text not null default 'active' check (status in ('active','suspended')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- VÍNCULO: usuário do Supabase Auth ↔ farmácia ↔ papel
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete cascade,
  role text not null check (role in ('superadmin','pharmacy_admin')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- HELPERS DE TENANT (security definer: leem profiles ignorando RLS)
-- ============================================================
create or replace function public.current_pharmacy_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select pharmacy_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'superadmin'
  )
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.pharmacies enable row level security;
alter table public.profiles enable row level security;

-- pharmacies: superadmin faz tudo; farmácia lê/edita só a própria linha
create policy "pharmacies superadmin all" on public.pharmacies
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "pharmacies self read" on public.pharmacies
  for select to authenticated
  using (id = public.current_pharmacy_id());

create policy "pharmacies self update" on public.pharmacies
  for update to authenticated
  using (id = public.current_pharmacy_id())
  with check (id = public.current_pharmacy_id());

-- anon lê dados públicos da farmácia ativa (marca/whatsapp) — necessário no catálogo
create policy "pharmacies anon read" on public.pharmacies
  for select to anon
  using (status = 'active');

-- profiles: cada um lê o próprio; superadmin lê/escreve todos
create policy "profiles self read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_superadmin());

create policy "profiles superadmin write" on public.profiles
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());
