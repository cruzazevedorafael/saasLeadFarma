-- supabase/migrations/0016_asaas_webhook_events.sql
-- Idempotência do webhook do Asaas: evita reprocessar o mesmo evento em
-- caso de retry/replay (acidental ou malicioso — sem isso, reenviar o mesmo
-- payload de PAYMENT_CONFIRMED repetidas vezes não causa dano hoje, mas
-- qualquer lógica futura que reaja a evento uma única vez precisa disso).
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0016_asaas_webhook_events.sql

create table if not exists public.asaas_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.asaas_webhook_events enable row level security;
-- sem policies → só service_role acessa (o webhook roda com createAdminClient()).
revoke all on public.asaas_webhook_events from anon, authenticated;

notify pgrst, 'reload schema';
