-- supabase/migrations/0014_aviso_estoque.sql

-- Pedido com estoque insuficiente agora é registrado mesmo assim; o aviso fica
-- gravado aqui pro painel mostrar e a loja combinar com o cliente.
alter table public.orders add column if not exists stock_warning text;
