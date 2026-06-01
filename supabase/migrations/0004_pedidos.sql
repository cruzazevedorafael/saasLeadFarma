-- supabase/migrations/0004_pedidos.sql

-- número sequencial humano do pedido (#1000, #1001, ...)
create sequence if not exists public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('public.order_number_seq'),
  customer_name text not null default '',
  customer_phone text not null default '',
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  price_type text not null default 'retail' check (price_type in ('retail','wholesale')),
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  product_code text not null default '',
  product_name text not null default '',
  size text not null default '',
  color text not null default '',
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0
);
create index on public.order_items(order_id);

-- RLS: só o admin (authenticated) acessa
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create policy "admin all orders" on public.orders for all to authenticated using (true) with check (true);
create policy "admin all order_items" on public.order_items for all to authenticated using (true) with check (true);

-- BAIXA atômica: valida estoque e desconta numa transação
create or replace function public.complete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_missing text;
  r record;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;

  select string_agg(oi.product_code || ' (' || oi.size || '/' || oi.color || ')', ', ')
    into v_missing
  from public.order_items oi
  join public.product_variants pv on pv.id = oi.variant_id
  where oi.order_id = p_order_id and pv.stock < oi.quantity;

  if v_missing is not null then
    raise exception 'Estoque insuficiente para: %', v_missing;
  end if;

  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock - r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;

  update public.orders set status='completed', completed_at=now() where id=p_order_id;
end;
$$;

revoke all on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to service_role;
