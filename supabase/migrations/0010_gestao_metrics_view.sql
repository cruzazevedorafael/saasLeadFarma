-- 0010 — View de métricas por farmácia para o painel de gestão (super-admin).
-- Uma query resolve o dashboard inteiro (KPIs gerais = agregação sobre a view).
-- SEGURANÇA: só o service_role (super-admin via createAdminClient) pode ler.
-- anon/authenticated NÃO têm acesso — não regride a proteção de PII do 0006.
-- Idempotente. Aplicar: node scripts/apply-migration.mjs supabase/migrations/0010_gestao_metrics_view.sql

create or replace view public.pharmacy_metrics as
select
  ph.id,
  ph.slug,
  ph.nome_exibicao,
  ph.nome_fantasia,
  ph.status,
  ph.plan,
  ph.subscription_status,
  ph.onboarding_completed,
  ph.trial_ends_at,
  ph.created_at,
  coalesce(o.n_pedidos, 0)    as n_pedidos,
  coalesce(o.n_concluidos, 0) as n_concluidos,
  coalesce(o.faturamento, 0)  as faturamento,
  coalesce(pr.n_produtos, 0)  as n_produtos
from public.pharmacies ph
left join (
  select
    pharmacy_id,
    count(*)                                                as n_pedidos,
    count(*) filter (where status = 'completed')            as n_concluidos,
    coalesce(sum(total) filter (where status = 'completed'), 0) as faturamento
  from public.orders
  group by pharmacy_id
) o on o.pharmacy_id = ph.id
left join (
  select pharmacy_id, count(*) filter (where active) as n_produtos
  from public.products
  group by pharmacy_id
) pr on pr.pharmacy_id = ph.id;

-- Bloqueia leitura por anon/authenticated; libera só service_role.
revoke all on public.pharmacy_metrics from anon, authenticated;
grant select on public.pharmacy_metrics to service_role;
