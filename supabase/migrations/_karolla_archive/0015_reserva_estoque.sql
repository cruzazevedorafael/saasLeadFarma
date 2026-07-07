-- supabase/migrations/0015_reserva_estoque.sql
-- Reserva de estoque no momento do pedido.
-- A partir daqui: pedido criado => estoque já sai (pending = reservado).
-- "Dar baixa" (complete_order) só confirma a venda; "Cancelar" (cancel_order) devolve.

-- 0) O estoque passa a poder ficar negativo (sinal de venda além do físico).
-- Sem isso, reservar a última peça numa corrida levantaria erro e bloquearia o pedido.
alter table public.product_variants drop constraint if exists product_variants_stock_check;

-- 1) Reserva: desconta o estoque dos itens do pedido. Permite negativo (não bloqueia).
create or replace function public.reserve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock - r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;
end;
$$;
revoke all on function public.reserve_order(uuid) from public, anon;
grant execute on function public.reserve_order(uuid) to service_role;

-- 2) Dar baixa: o estoque já saiu na criação; aqui só confirma a venda.
create or replace function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;

  update public.orders set status='completed', completed_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to service_role;

-- 3) Cancelar: devolve as peças ao estoque. Trava no status pending (não devolve 2x).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  r record;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;

  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock + r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;

  update public.orders set status='cancelled', cancelled_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to service_role;

-- 4) Migração única: reserva o estoque dos pedidos que já estão pendentes,
-- pra todos ficarem na nova regra (pendente = já reservado).
update public.product_variants pv
set stock = pv.stock - agg.qty, updated_at = now()
from (
  select oi.variant_id, sum(oi.quantity) as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'pending' and oi.variant_id is not null
  group by oi.variant_id
) agg
where pv.id = agg.variant_id;
