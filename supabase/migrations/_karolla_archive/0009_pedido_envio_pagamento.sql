-- supabase/migrations/0009_pedido_envio_pagamento.sql
alter table public.orders
  add column items_subtotal numeric(10,2) not null default 0,
  add column shipping_label text not null default '',
  add column shipping_price numeric(10,2) not null default 0,
  add column payment_label text not null default '',
  add column payment_surcharge numeric(10,2) not null default 0;
