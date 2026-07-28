-- supabase/migrations/0015_lockdown_security_definer.sql
-- Fecha a brecha: authenticated mantinha EXECUTE default nas funções
-- security definer de pedido/carrinho/cliente (as migrations 0002/0004
-- revogaram de anon/public, mas nunca de authenticated — que herda o grant
-- automático que o Supabase concede na criação da função). Qualquer farmácia
-- auto-cadastrada em /cadastro (público, sem aprovação) ganhava um JWT
-- authenticated e podia chamar essas funções direto via PostgREST
-- (POST /rest/v1/rpc/<função>), ignorando toda a lógica das Server Actions:
-- cancelar pedido de outra farmácia, sobrescrever cadastro de cliente alheio,
-- zerar estoque de concorrente.
--
-- Nenhum fluxo do app é afetado: todas essas funções já são chamadas
-- exclusivamente por Server Actions via createAdminClient() (service_role),
-- que ignora GRANT/REVOKE de qualquer forma.
--
-- Aplicar: node scripts/apply-migration.mjs supabase/migrations/0015_lockdown_security_definer.sql

revoke execute on function public.reserve_order(uuid) from authenticated;
revoke execute on function public.complete_order(uuid) from authenticated;
revoke execute on function public.cancel_order(uuid) from authenticated;
revoke execute on function public.reservar_item(uuid, uuid, int) from authenticated;
revoke execute on function public.liberar_item(uuid, uuid) from authenticated;
revoke execute on function public.liberar_carrinho(uuid) from authenticated;
revoke execute on function public.upsert_customer(uuid, text, text, text, text, text, text, text, text, text, text, boolean) from authenticated;
revoke execute on function public.increment_customer_orders(uuid) from authenticated;
