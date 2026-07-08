-- 0007_marca_farmacia.sql — Fase (identidade): cor de destaque por farmácia.
-- accent_color: cor extraída da logo (hex), usada pra deixar o catálogo com a cara
-- da farmácia. Vazio/null = usa o laranja padrão do LeadFarma (#F97316).
alter table public.pharmacies add column if not exists accent_color text;

-- permite o anon (catálogo) ler a cor e a logo (já lê nome/logo; garantimos a coluna nova)
revoke select on public.pharmacies from anon;
grant select (
  id, slug, nome_exibicao, nome_fantasia, logo_url, banner_image_url,
  whatsapp_number, wholesale_threshold, status, accent_color
) on public.pharmacies to anon;
