-- 0002_catalog_e_negocio_tenant.sql — Tabelas de negócio, agora multi-tenant.
-- Mesma forma do sistema atual (Karolla, arquivado em _karolla_archive/), porém:
--  * toda tabela de negócio ganha pharmacy_id (FK pharmacies, cascade);
--  * chaves únicas antes globais passam a ser únicas POR farmácia;
--  * RLS isola por tenant (pharmacy_id = current_pharmacy_id() OU superadmin);
--  * views públicas expõem o slug e filtram farmácia ativa.
-- O reshape do produto para farmácia (marca, EAN, receita, apresentação) é Fase 1.

-- ============================================================
-- PRODUTOS
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  code text,
  name text not null,
  category text not null default '',
  description text not null default '',
  image_url text,
  image_urls text[] not null default '{}',
  price_cost numeric(10,2) not null default 0,
  price_wholesale numeric(10,2) not null default 0,
  price_retail numeric(10,2) not null default 0,
  min_wholesale int not null default 1,
  counts_for_wholesale boolean not null default true,
  weight_grams int not null default 0,
  on_promo boolean not null default false,
  promo_price numeric,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- código opcional, único POR farmácia quando preenchido
create unique index products_pharmacy_code_unique
  on public.products (pharmacy_id, code)
  where code is not null and code <> '';
create index products_pharmacy_idx on public.products (pharmacy_id);

-- ============================================================
-- VARIAÇÕES (tamanho + cor) — pharmacy_id redundante p/ RLS direta
-- ============================================================
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  stock int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index product_variants_pharmacy_idx on public.product_variants (pharmacy_id);

-- ============================================================
-- CATEGORIAS — nome único POR farmácia
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, name)
);

-- ============================================================
-- FORMAS DE ENVIO
-- ============================================================
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipping_methods_pharmacy_idx on public.shipping_methods (pharmacy_id);

-- ============================================================
-- FORMAS DE PAGAMENTO
-- ============================================================
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  name text not null,
  surcharge_percent numeric(5,2) not null default 0,
  surcharge_fixed numeric(10,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_methods_pharmacy_idx on public.payment_methods (pharmacy_id);

-- ============================================================
-- PEDIDOS
-- ============================================================
create sequence if not exists public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  number int not null unique default nextval('public.order_number_seq'),
  customer_name text not null default '',
  customer_phone text not null default '',
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  price_type text not null default 'retail' check (price_type in ('retail','wholesale')),
  total numeric(10,2) not null default 0,
  items_subtotal numeric(10,2) not null default 0,
  shipping_label text not null default '',
  shipping_price numeric(10,2) not null default 0,
  payment_label text not null default '',
  payment_surcharge numeric(10,2) not null default 0,
  stock_warning text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index orders_pharmacy_idx on public.orders (pharmacy_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  product_code text not null default '',
  product_name text not null default '',
  size text not null default '',
  color text not null default '',
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  weight_grams int not null default 0
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_pharmacy_idx on public.order_items (pharmacy_id);

-- ============================================================
-- RESERVA DE ESTOQUE NO CARRINHO (mantida na Fase 0; removida na Fase 2)
-- Keyed por cart_id/variant_id; acessada só via funções security definer.
-- ============================================================
create table public.cart_reservations (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null check (quantity > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index cart_reservations_variant_idx on public.cart_reservations (variant_id);
create index cart_reservations_expires_idx on public.cart_reservations (expires_at);

-- ============================================================
-- RLS — isolamento por tenant
-- ============================================================
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.categories enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.payment_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.cart_reservations enable row level security;

-- padrão tenant: dono ou superadmin
create policy "products tenant all" on public.products for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
create policy "variants tenant all" on public.product_variants for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
create policy "categories tenant all" on public.categories for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
create policy "shipping tenant all" on public.shipping_methods for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
create policy "payment tenant all" on public.payment_methods for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
create policy "orders tenant all" on public.orders for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
create policy "order_items tenant all" on public.order_items for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());

-- anon lê envio/pagamento de farmácias ativas (catálogo público precisa)
create policy "shipping anon read" on public.shipping_methods for select to anon
  using (active and pharmacy_id in (select id from public.pharmacies where status = 'active'));
create policy "payment anon read" on public.payment_methods for select to anon
  using (active and pharmacy_id in (select id from public.pharmacies where status = 'active'));

-- ============================================================
-- VIEWS PÚBLICAS (rodam como dono; anon lê o catálogo por slug)
-- ============================================================
create view public.public_products with (security_invoker = false) as
  select p.id, p.pharmacy_id, ph.slug,
         p.code, p.name, p.category, p.description, p.image_url, p.image_urls,
         p.price_wholesale, p.price_retail, p.min_wholesale, p.sort_order,
         p.counts_for_wholesale, p.weight_grams, p.on_promo, p.promo_price
  from public.products p
  join public.pharmacies ph on ph.id = p.pharmacy_id
  where p.active = true and ph.status = 'active';

create view public.public_product_variants with (security_invoker = false) as
  select pv.id, pv.product_id, pv.pharmacy_id, pv.size, pv.color,
         ((pv.stock - coalesce(r.reserved, 0)) > 0) as available,
         greatest(pv.stock - coalesce(r.reserved, 0), 0)::int as stock
  from public.product_variants pv
  left join (
    select variant_id, sum(quantity)::int as reserved
    from public.cart_reservations
    where expires_at > now()
    group by variant_id
  ) r on r.variant_id = pv.id;

grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;

-- ============================================================
-- FUNÇÕES DE PEDIDO / RESERVA (security definer, service_role)
-- Operam por order_id/variant_id (que já pertencem a uma farmácia).
-- ============================================================
create or replace function public.reserve_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select variant_id, quantity from public.order_items
           where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock - r.quantity, updated_at = now()
    where id = r.variant_id;
  end loop;
end; $$;
revoke all on function public.reserve_order(uuid) from public, anon;
grant execute on function public.reserve_order(uuid) to service_role;

create or replace function public.complete_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then raise exception 'Pedido não encontrado'; end if;
  if v_status <> 'pending' then raise exception 'Pedido não está pendente'; end if;
  update public.orders set status='completed', completed_at=now() where id=p_order_id;
end; $$;
revoke all on function public.complete_order(uuid) from public, anon;
grant execute on function public.complete_order(uuid) to service_role;

create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text; r record;
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
end; $$;
revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to service_role;

create or replace function public.reservar_item(p_cart_id uuid, p_variant_id uuid, p_quantity int)
returns int language plpgsql security definer set search_path = public as $$
declare v_stock int; v_others int; v_grant int;
begin
  delete from public.cart_reservations where expires_at <= now();
  if p_quantity <= 0 then
    delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
    return 0;
  end if;
  select stock into v_stock from public.product_variants where id = p_variant_id for update;
  if v_stock is null then return 0; end if;
  select coalesce(sum(quantity), 0)::int into v_others
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
end; $$;
revoke all on function public.reservar_item(uuid, uuid, int) from public, anon;
grant execute on function public.reservar_item(uuid, uuid, int) to service_role;

create or replace function public.liberar_item(p_cart_id uuid, p_variant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.cart_reservations where cart_id = p_cart_id and variant_id = p_variant_id;
end; $$;
revoke all on function public.liberar_item(uuid, uuid) from public, anon;
grant execute on function public.liberar_item(uuid, uuid) to service_role;

create or replace function public.liberar_carrinho(p_cart_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.cart_reservations where cart_id = p_cart_id;
end; $$;
revoke all on function public.liberar_carrinho(uuid) from public, anon;
grant execute on function public.liberar_carrinho(uuid) to service_role;
