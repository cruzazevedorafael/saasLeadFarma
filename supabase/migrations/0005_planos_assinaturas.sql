-- 0005_planos_assinaturas.sql — Fase 5: planos, período de teste e assinatura (ASAAS).
-- Idempotente. A cobrança via ASAAS é ativada por variáveis de ambiente (ver lib/asaas).
--
-- plan                : trial | basic | pro
-- subscription_status : trialing | active | past_due | canceled
-- asaas_*             : ids do cliente/assinatura no ASAAS (preenchidos quando integrado)

alter table public.pharmacies add column if not exists plan text not null default 'trial'
  check (plan in ('trial', 'basic', 'pro'));
alter table public.pharmacies add column if not exists subscription_status text not null default 'trialing'
  check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));
alter table public.pharmacies add column if not exists trial_ends_at timestamptz;
alter table public.pharmacies add column if not exists asaas_customer_id text;
alter table public.pharmacies add column if not exists asaas_subscription_id text;

-- Farmácias já existentes (teste/seed) seguem ativas sem cobrança.
update public.pharmacies set subscription_status = 'active', plan = 'pro'
  where subscription_status = 'trialing' and trial_ends_at is null and created_at < now() - interval '1 minute';
