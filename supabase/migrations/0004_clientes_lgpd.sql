-- 0004_clientes_lgpd.sql — Fase 2: cadastro de cliente, histórico versionado, LGPD.
-- Idempotente. Cada farmácia tem sua própria base de clientes (isolada por RLS).
--
-- Modelo:
--   customers          → dado ATUAL do cliente (1 linha por CPF por farmácia)
--   customer_history   → versões ANTIGAS (snapshot gravado antes de cada alteração)
--   orders.*           → snapshot do cliente NO momento do pedido (CPF + endereço)
--
-- A busca por CPF (autofill no catálogo) e a gravação passam pela função
-- upsert_customer (security definer, só service_role) — o catálogo é anônimo.

-- ============================================================
-- CLIENTES (dado atual)
-- ============================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  cpf text not null,                        -- só dígitos
  name text not null,
  phone text not null default '',
  cep text not null default '',
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  uf text not null default '',
  lgpd_consent boolean not null default false,
  lgpd_consent_at timestamptz,
  orders_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, cpf)
);
create index if not exists customers_pharmacy_idx on public.customers (pharmacy_id);

-- ============================================================
-- HISTÓRICO (versões antigas do cadastro)
-- ============================================================
create table if not exists public.customer_history (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text, phone text, cep text, logradouro text, numero text,
  complemento text, bairro text, cidade text, uf text,
  created_at timestamptz not null default now()
);
create index if not exists customer_history_customer_idx on public.customer_history (customer_id);

-- ============================================================
-- SNAPSHOT DO CLIENTE NO PEDIDO
-- ============================================================
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists customer_cpf text not null default '';
alter table public.orders add column if not exists customer_cep text not null default '';
alter table public.orders add column if not exists customer_logradouro text not null default '';
alter table public.orders add column if not exists customer_numero text not null default '';
alter table public.orders add column if not exists customer_complemento text not null default '';
alter table public.orders add column if not exists customer_bairro text not null default '';
alter table public.orders add column if not exists customer_cidade text not null default '';
alter table public.orders add column if not exists customer_uf text not null default '';

-- ============================================================
-- RLS — clientes/histórico isolados por tenant (leitura no painel)
-- ============================================================
alter table public.customers enable row level security;
alter table public.customer_history enable row level security;

drop policy if exists "customers tenant all" on public.customers;
create policy "customers tenant all" on public.customers for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());

drop policy if exists "customer_history tenant all" on public.customer_history;
create policy "customer_history tenant all" on public.customer_history for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());

-- ============================================================
-- upsert_customer — grava/atualiza cliente versionando o dado antigo.
-- Retorna o id do cliente. Só service_role (o catálogo chama via server action).
-- ============================================================
create or replace function public.upsert_customer(
  p_pharmacy_id uuid, p_cpf text, p_name text, p_phone text,
  p_cep text, p_logradouro text, p_numero text, p_complemento text,
  p_bairro text, p_cidade text, p_uf text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare c record; v_id uuid; v_changed boolean;
begin
  select * into c from public.customers
    where pharmacy_id = p_pharmacy_id and cpf = p_cpf for update;

  if c.id is null then
    insert into public.customers
      (pharmacy_id, cpf, name, phone, cep, logradouro, numero, complemento, bairro, cidade, uf,
       lgpd_consent, lgpd_consent_at)
    values
      (p_pharmacy_id, p_cpf, p_name, p_phone, p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf,
       p_consent, case when p_consent then now() else null end)
    returning id into v_id;
    return v_id;
  end if;

  -- houve mudança em algum campo do cadastro?
  v_changed := (c.name is distinct from p_name) or (c.phone is distinct from p_phone)
    or (c.cep is distinct from p_cep) or (c.logradouro is distinct from p_logradouro)
    or (c.numero is distinct from p_numero) or (c.complemento is distinct from p_complemento)
    or (c.bairro is distinct from p_bairro) or (c.cidade is distinct from p_cidade)
    or (c.uf is distinct from p_uf);

  if v_changed then
    insert into public.customer_history
      (pharmacy_id, customer_id, name, phone, cep, logradouro, numero, complemento, bairro, cidade, uf)
    values
      (c.pharmacy_id, c.id, c.name, c.phone, c.cep, c.logradouro, c.numero, c.complemento, c.bairro, c.cidade, c.uf);
    update public.customers set
      name = p_name, phone = p_phone, cep = p_cep, logradouro = p_logradouro,
      numero = p_numero, complemento = p_complemento, bairro = p_bairro,
      cidade = p_cidade, uf = p_uf, updated_at = now()
    where id = c.id;
  end if;

  -- consentimento: registra a primeira vez que o cliente autorizou
  if p_consent and not c.lgpd_consent then
    update public.customers set lgpd_consent = true, lgpd_consent_at = now() where id = c.id;
  end if;

  return c.id;
end; $$;
revoke all on function public.upsert_customer(uuid, text, text, text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.upsert_customer(uuid, text, text, text, text, text, text, text, text, text, text, boolean) to service_role;

-- incremento atômico do contador de pedidos do cliente
create or replace function public.increment_customer_orders(p_customer_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.customers set orders_count = orders_count + 1, updated_at = now()
  where id = p_customer_id;
$$;
revoke all on function public.increment_customer_orders(uuid) from public, anon;
grant execute on function public.increment_customer_orders(uuid) to service_role;
