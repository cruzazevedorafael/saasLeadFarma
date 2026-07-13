-- 0009 — Hardening de segurança + índices de performance
-- Idempotente. Aplicar com: node scripts/apply-migration.mjs supabase/migrations/0009_hardening_pharmacies_e_indices.sql

-- ============================================================================
-- A) Trigger: impede a FARMÁCIA (authenticated) de alterar campos gerenciados
--    pela plataforma via console (auto-upgrade de plano, reativar suspensão etc).
--    service_role (provisioning/webhook/gestão) e superadmin passam livres.
-- ============================================================================
create or replace function public.pharmacies_guard_sensitive_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_claim text := coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
begin
  -- Só restringe usuário autenticado comum (JWT role = 'authenticated'). Ler o claim
  -- do JWT é à prova de SECURITY DEFINER (current_user viraria o dono da função).
  -- service_role (provisioning/webhook/gestão), anon e superadmin passam livres.
  if role_claim <> 'authenticated' or public.is_superadmin() then
    return new;
  end if;

  if new.plan               is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.status             is distinct from old.status
     or new.trial_ends_at      is distinct from old.trial_ends_at
     or new.asaas_customer_id  is distinct from old.asaas_customer_id
     or new.asaas_subscription_id is distinct from old.asaas_subscription_id
     or new.slug               is distinct from old.slug
  then
    raise exception 'Campos de plano, assinatura, status e slug são gerenciados pela plataforma.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pharmacies_guard on public.pharmacies;
create trigger trg_pharmacies_guard
  before update on public.pharmacies
  for each row execute function public.pharmacies_guard_sensitive_cols();

-- ============================================================================
-- B) Índices de performance (aditivos, IF NOT EXISTS) — alinhados ao padrão
--    multi-tenant (pharmacy_id primeiro) e às queries reais (orders/customers).
-- ============================================================================
create index if not exists orders_pharmacy_created_idx
  on public.orders (pharmacy_id, created_at desc);

create index if not exists orders_pharmacy_status_created_idx
  on public.orders (pharmacy_id, status, created_at desc);

create index if not exists order_items_product_idx
  on public.order_items (product_id);

create index if not exists customers_pharmacy_updated_idx
  on public.customers (pharmacy_id, updated_at desc);
