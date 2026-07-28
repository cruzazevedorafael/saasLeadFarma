-- 0014 — Habilita Supabase Realtime (Postgres Changes) na tabela orders.
-- Usado pelo painel (lista de pedidos) para destacar pedido novo sem reload.
-- A RLS existente ("orders tenant all", 0002) já filtra por pharmacy_id =
-- current_pharmacy_id() — Postgres Changes respeita essa RLS nativamente para
-- conexões autenticadas, não precisa de policy extra.
-- Aplicar: node scripts/apply-migration.mjs 0014_realtime_orders.sql

alter publication supabase_realtime add table public.orders;
