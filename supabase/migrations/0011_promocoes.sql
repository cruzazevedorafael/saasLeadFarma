-- 0011 — Promoções (até 10 por farmácia). Substitui o banner único no catálogo.
-- Idempotente. Aplicar: node scripts/apply-migration.mjs supabase/migrations/0011_promocoes.sql

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists promotions_pharmacy_idx on public.promotions (pharmacy_id, sort_order);

alter table public.promotions enable row level security;

-- padrão tenant: dono ou superadmin
drop policy if exists "promotions tenant all" on public.promotions;
create policy "promotions tenant all" on public.promotions for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());

-- Teto de 10 promoções por farmácia (defesa no banco, além do app).
create or replace function public.promotions_max10()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.promotions where pharmacy_id = new.pharmacy_id) >= 10 then
    raise exception 'Limite de 10 promoções por farmácia.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_promotions_max10 on public.promotions;
create trigger trg_promotions_max10 before insert on public.promotions
  for each row execute function public.promotions_max10();

-- View pública: anon lê promoções ativas de farmácias ativas (catálogo).
drop view if exists public.public_promotions;
create view public.public_promotions with (security_invoker = false) as
  select pr.id, pr.pharmacy_id, ph.slug, pr.image_url, pr.sort_order
  from public.promotions pr
  join public.pharmacies ph on ph.id = pr.pharmacy_id
  where pr.active = true and ph.status = 'active';
grant select on public.public_promotions to anon;

notify pgrst, 'reload schema';
