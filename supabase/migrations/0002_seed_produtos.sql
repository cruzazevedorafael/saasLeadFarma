-- supabase/migrations/0002_seed_produtos.sql

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('LEG-001','Legging Suplex Premium','Leggings','Legging de alta compressão com tecido suplex premium. Cintura alta que modela o corpo.','https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=500&fit=crop',0,49.90,89.90,1,1)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Cinza','Azul Marinho']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('TOP-001','Top Nadador Fitness','Tops','Top nadador com sustentação média-alta. Ideal para treinos intensos.','https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop',0,34.90,59.90,1,2)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Rosa','Verde Neon']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('CONJ-001','Conjunto Seamless','Conjuntos','Conjunto sem costuras que proporciona conforto máximo. Legging + Top combinando.','https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',0,89.90,159.90,1,3)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Nude','Cinza']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('SHORT-001','Short Saia Academia','Shorts','Short saia com shorts interno anti-transparência. Perfeito para corrida.','https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=500&fit=crop',0,39.90,69.90,1,4)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Vermelho','Branco']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('REG-001','Regata Dry Fit','Regatas','Regata com tecnologia dry fit que mantém o corpo seco durante o treino.','https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=400&h=500&fit=crop',0,29.90,49.90,1,5)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Branco','Preto','Rosa']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('CALC-001','Calça Jogger Fitness','Calcas','Calça jogger estilo esportivo com bolsos laterais e punhos nas pernas.','https://images.unsplash.com/photo-1556906918-c3071bd15252?w=400&h=500&fit=crop',0,69.90,119.90,1,6)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Cinza Mescla','Verde Militar']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('BODY-001','Body Fitness Decote V','Bodies','Body com decote V e costas nadador. Tecido com proteção UV.','https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=500&fit=crop',0,44.90,79.90,1,7)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Nude','Bordô']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('BERM-001','Bermuda Ciclista','Bermudas','Bermuda ciclista cintura alta com compressão. Não marca celulite.','https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=400&h=500&fit=crop',0,34.90,59.90,1,8)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Cinza','Rosa']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('JAQ-001','Jaqueta Corta Vento','Jaquetas','Jaqueta leve corta vento com capuz. Ideal para corridas ao ar livre.','https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=500&fit=crop',0,74.90,129.90,1,9)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Verde Neon','Branco']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('CROP-001','Cropped Manga Longa','Croppeds','Cropped manga longa com proteção solar UV50+. Design moderno.','https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400&h=500&fit=crop',0,39.90,69.90,1,10)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Branco','Cinza']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('LEG-002','Legging Empina Bumbum','Leggings','Legging com tecnologia que realça os glúteos. Costura scrunch no bumbum.','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=500&fit=crop',0,54.90,99.90,1,11)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Vinho','Azul Petróleo']) as c(color);

with p as (
  insert into public.products (code, name, category, description, image_url, price_cost, price_wholesale, price_retail, min_wholesale, sort_order)
  values ('TOP-002','Top Long Line','Tops','Top alongado com bojo removível. Alta sustentação e conforto.','https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=500&fit=crop',0,37.90,64.90,1,12)
  returning id)
insert into public.product_variants (product_id, size, color, stock)
select p.id, s.size, c.color, 5 from p,
  unnest(array['P','M','G','GG']) as s(size),
  unnest(array['Preto','Lilás','Verde Água']) as c(color);
