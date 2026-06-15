-- supabase/migrations/0016_reserva_carrinho.sql
-- Reserva de estoque no carrinho: trava a peça por 30 min, expira sozinha.

create table if not exists public.cart_reservations (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index if not exists cart_reservations_variant_idx on public.cart_reservations(variant_id);
create index if not exists cart_reservations_expires_idx on public.cart_reservations(expires_at);

-- Ninguém acessa a tabela direto; tudo via funções security definer (service_role).
alter table public.cart_reservations enable row level security;

-- Reserva (ou ajusta) a quantidade de uma variação para um carrinho.
-- Retorna quanto foi efetivamente reservado (pode ser menor que o pedido).
create or replace function public.reservar_item(p_cart_id uuid, p_variant_id uuid, p_quantity int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock int;
  v_others int;
  v_grant int;
begin
  -- limpeza oportunista das reservas vencidas
  delete from public.cart_reservations where expires_at <= now();

  -- quantidade não positiva: solta a reserva desse carrinho e sai
  if p_quantity <= 0 then
    delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
    return 0;
  end if;

  -- trava a linha da variação pra serializar a corrida
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if v_stock is null then
    return 0;
  end if;

  select coalesce(sum(quantity), 0) into v_others
  from public.cart_reservations
  where variant_id = p_variant_id and cart_id <> p_cart_id and expires_at > now();

  v_grant := least(p_quantity, greatest(v_stock - v_others, 0));

  if v_grant <= 0 then
    delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
    return 0;
  end if;

  insert into public.cart_reservations (cart_id, variant_id, quantity, expires_at, updated_at)
  values (p_cart_id, p_variant_id, v_grant, now() + interval '30 minutes', now())
  on conflict (cart_id, variant_id)
  do update set quantity = excluded.quantity, expires_at = excluded.expires_at, updated_at = now();

  return v_grant;
end;
$$;
revoke all on function public.reservar_item(uuid, uuid, int) from public, anon;
grant execute on function public.reservar_item(uuid, uuid, int) to service_role;

create or replace function public.liberar_item(p_cart_id uuid, p_variant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
end;
$$;
revoke all on function public.liberar_item(uuid, uuid) from public, anon;
grant execute on function public.liberar_item(uuid, uuid) to service_role;

create or replace function public.liberar_carrinho(p_cart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cart_reservations where cart_id = p_cart_id;
end;
$$;
revoke all on function public.liberar_carrinho(uuid) from public, anon;
grant execute on function public.liberar_carrinho(uuid) to service_role;

-- View pública de variações: estoque JÁ descontado das reservas ativas.
-- Mantém as mesmas colunas/tipos (id, product_id, size, color, available, stock)
-- pra não quebrar quem consome (create or replace view exige isso).
create or replace view public.public_product_variants
  with (security_invoker = false) as
  select pv.id, pv.product_id, pv.size, pv.color,
         ((pv.stock - coalesce(r.reserved, 0)) > 0) as available,
         greatest(pv.stock - coalesce(r.reserved, 0), 0) as stock
  from public.product_variants pv
  left join (
    select variant_id, sum(quantity) as reserved
    from public.cart_reservations
    where expires_at > now()
    group by variant_id
  ) r on r.variant_id = pv.id;

grant select on public.public_product_variants to anon;
