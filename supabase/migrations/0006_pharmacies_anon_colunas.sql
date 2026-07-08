-- 0006_pharmacies_anon_colunas.sql — corrige exposição de PII cadastral.
-- Antes: o anon (catálogo) lia TODAS as colunas de pharmacies (cnpj, email, telefone,
-- farmacêutico, CRF, ids do ASAAS...) de qualquer farmácia ativa. Agora o anon só
-- enxerga as colunas PÚBLICAS do catálogo. O painel (authenticated) e o service_role
-- continuam com acesso total. Idempotente.

revoke select on public.pharmacies from anon;

grant select (
  id, slug, nome_exibicao, nome_fantasia, logo_url, banner_image_url,
  whatsapp_number, wholesale_threshold, status
) on public.pharmacies to anon;
