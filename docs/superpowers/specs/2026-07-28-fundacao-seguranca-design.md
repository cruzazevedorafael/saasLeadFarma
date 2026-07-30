# LeadFarma — Fundação de Segurança (Bloco 1 de 5) — Design

**Data:** 2026-07-28
**Bloco:** 1 de 5 do programa "sistema completo pensando em escala". Os demais: 2 Observabilidade mínima · 3 Ciclo de vida de assinatura automático · 4 Compliance de receita · 5 Confiabilidade operacional.

## Contexto

Auditoria de segurança/completude/prontidão operacional (2026-07-27) encontrou uma série de lacunas que bloqueiam liberar o LeadFarma para uma farmácia real com dados de cliente reais (CPF, endereço, telefone). Este bloco resolve os itens de segurança verdadeiramente bloqueantes antes de qualquer outro trabalho — os demais blocos (cobrança automática, compliance de receita, observabilidade, confiabilidade operacional) dependem de uma base que não vaza dado nem permite bypass de isolamento entre farmácias.

Escala-alvo: "base sólida pronta pra dezenas ou centenas de farmácias, sem superdimensionar agora" — decisão do usuário. Time: só o usuário + Claude, sem outros devs — logging/alertas devem ser simples e ir direto pro usuário, sem infraestrutura de equipe.

## 1. Travar as funções `SECURITY DEFINER` (RLS bypass)

**Problema:** `cancel_order`, `complete_order`, `reserve_order`, `reservar_item`, `liberar_item`, `liberar_carrinho`, `upsert_customer`, `increment_customer_orders` (definidas em `supabase/migrations/0002_catalog_e_negocio_tenant.sql` e `0004_clientes_lgpd.sql`) são `SECURITY DEFINER` e rodam ignorando RLS. As migrations revogam `EXECUTE` de `anon`/`public`, mas nunca de `authenticated` — que mantém o grant automático que o Supabase concede na criação da função. Qualquer farmácia auto-cadastrada em `/cadastro` (público, sem aprovação) ganha um JWT `authenticated` e pode chamar essas funções direto via PostgREST (`POST /rest/v1/rpc/<função>`), ignorando toda a lógica das Server Actions — cancelar pedido de outra farmácia, sobrescrever cadastro de cliente alheio, zerar estoque de concorrente.

**Fix:** nova migration `0015_lockdown_security_definer.sql`:
```sql
revoke execute on function
  public.cancel_order, public.complete_order, public.reserve_order,
  public.reservar_item, public.liberar_item, public.liberar_carrinho,
  public.upsert_customer, public.increment_customer_orders
from authenticated;
```
Antes de escrever a migration final, rodar um levantamento completo de **todas** as funções `SECURITY DEFINER` do schema `public` (não só as 8 já identificadas — pode haver outras) e confirmar, por grep no código-fonte, que nenhuma delas é chamada por um client não-admin (browser/anon/authenticated) — todas devem passar exclusivamente por `createAdminClient()` em Server Actions. Nenhum fluxo do app depende de `authenticated` chamar RPC direto, então o revoke não quebra nada em uso.

**Teste:** teste de integração que autentica como um `pharmacy_admin` de teste e tenta chamar cada função via `supabase.rpc(...)` — espera erro de permissão (`42501`) em todas.

## 2. Rate limiting (Upstash Redis)

**Decisão:** Upstash Redis via Vercel Marketplace + `@upstash/ratelimit`, em vez de contador no Postgres — mais rápido, não compete por recursos com o banco principal, custo baixo/gratuito no volume esperado (free tier: 500 mil comandos/mês).

**Limites por endpoint** (algoritmo sliding window, chave = IP, exceto onde indicado; ajustáveis depois sem mudança estrutural):

| Endpoint | Limite | Chave |
|---|---|---|
| `app/painel/login/actions.ts` (login) | 5 tentativas / 15 min | IP + e-mail |
| `app/cadastro/actions.ts` (auto-cadastro) | 5 / hora | IP |
| `app/_actions/buscar-cliente.ts` | 5 tentativas / 10 min | IP + `pharmacyId` |
| `app/_actions/reserva-carrinho.ts` (`reservarItem`) | 30 / min | IP |
| `app/_actions/criar-pedido.ts` | 10 / hora | IP |

**Implementação:** helper único `lib/rate-limit.ts` exportando `checkRateLimit(key, config)` que encapsula o cliente Upstash — cada Server Action chama isso no topo, antes de qualquer efeito colateral, e retorna erro amigável (`{ ok: false, error: 'Muitas tentativas, tente novamente em alguns minutos.' }`) se excedido, seguindo o mesmo formato de retorno que as actions já usam.

**Teste:** unitário com o cliente Upstash mockado (não bater no serviço real em CI) — confirma que a 6ª tentativa em 15 min é bloqueada, etc.

## 3. Webhook Asaas — fail-closed

**Problema:** `app/api/asaas/webhook/route.ts:16-20` só valida o token se `ASAAS_WEBHOOK_TOKEN` existir — sem a env var (hoje é o caso), aceita qualquer POST não autenticado, permitindo forjar `PAYMENT_CONFIRMED`/`SUBSCRIPTION_DELETED` pra qualquer farmácia.

**Fix:**
- Se `ASAAS_WEBHOOK_TOKEN` não estiver configurado → responder `500` (erro de configuração do servidor) e logar, nunca aceitar silenciosamente.
- Comparação de token via `crypto.timingSafeEqual` (não `!==`), com padding de tamanho igual antes de comparar (evita exception em tamanhos diferentes).
- Tabela nova `asaas_webhook_events (event_id text primary key, processed_at timestamptz)` — antes de processar, checar se `event.id` já foi visto; se sim, responder 200 sem reprocessar (idempotência/anti-replay).

**Teste:** requisição sem token com env var setada → 401; requisição com token errado → 401; requisição sem env var → 500; requisição com `event.id` repetido → processa uma vez só.

## 4. View `public_product_variants` vazando estoque

**Problema:** `supabase/migrations/0002_catalog_e_negocio_tenant.sql:213-226` cria a view com `security_invoker=false` e `grant select ... to anon`, sem filtrar `pharmacy.status='active'` nem `product.active` (diferente de `public_products`, que já filtra) — qualquer anônimo lê estoque de todas as farmácias, inclusive suspensas, via `GET /rest/v1/public_product_variants`.

**Fix:** migration que recria a view espelhando o filtro de `public_products` (join com `pharmacies`/`products` ativos) e remove `pharmacy_id` das colunas retornadas ao anon (o catálogo público já resolve produtos pelo `slug` da farmácia, não precisa desse campo na resposta).

**Teste:** requisição REST anônima contra a view — confirma que produto de farmácia suspensa/inativa não aparece, e que `pharmacy_id` não está no payload.

## 5. Validação zod em `criarPedido`

**Problema:** `app/_actions/criar-pedido.ts` é a única Server Action pública de escrita sem schema zod (compare com `app/cadastro/actions.ts` e `app/gestao/actions.ts`) — sem limite de tamanho em nome/telefone/endereço, sem checar se a farmácia está `active`.

**Fix:** schema zod no topo da action espelhando os limites já usados no cadastro (nome ≤120 chars, telefone formato BR, CEP/endereço com máximos razoáveis, quantidade de item > 0 e ≤ 999); adicionar checagem `pharmacy.status === 'active'` antes de aceitar o pedido (retornar erro amigável se suspensa).

**Teste:** payload com campos gigantes/malformados é rejeitado; pedido pra farmácia suspensa é rejeitado.

## 6. Retenção de dados (LGPD) — mantém como está

**Decisão do usuário, com orientação jurídica confirmada:** dados de cliente e histórico de compra continuam salvos e identificados por padrão — nenhuma mudança de comportamento aqui. A base legal não é só o consentimento; é também cumprimento de obrigação legal/comprovação de venda (Art. 16, I da LGPD), que autoriza a retenção mesmo além do consentimento original.

**Único ajuste (copy, não lógica):** o texto de consentimento no checkout (`components/checkout-cliente.tsx`) passa a deixar explícito que os dados da compra em si são sempre usados para cumprir aquele pedido; a opção de consentimento controla apenas se o cadastro fica salvo para autopreenchimento em compras futuras (`customers`).

**Fora de escopo deste bloco:** mecanismo de anonimização/exclusão sob pedido formal do titular. Fica registrado como item de backlog — só entra se/quando um pedido real desse tipo acontecer, caso a caso.

## 7. Itens operacionais (mecânicos)

- Trocar a senha do superadmin (`leadfarma.br@gmail.com`) no Supabase Auth — feito fora do código, direto no dashboard.
- Remover a senha em texto plano de `scripts/seed-fase0.mjs`, `docs/05-SETUP-E-EXECUCAO.md` e `docs/superpowers/plans/2026-07-07-leadfarma-fase-0-fundacao-multitenant.md`, substituindo por instrução de gerar/definir a senha manualmente. Histórico do Git **não** será reescrito (decisão do usuário — senha trocada já invalida o valor exposto).
- Atualizar `next` para `>=16.2.11` (corrige CVE de bypass de middleware) — rodar build + suíte de testes depois pra confirmar que não quebrou nada.
- Commitar `supabase/migrations/0014_realtime_orders.sql` e os componentes `app/painel/pedidos/_components/pedidos-list.tsx`/`pedido-card.tsx`, que hoje existem só em disco (untracked no Git) — sem isso, um deploy limpo perde a feature de pedido em tempo real.

## Fora de escopo deste bloco

Error tracking/Sentry, `error.tsx`/`not-found.tsx`, cron de suspensão automática por inadimplência, trava de receita obrigatória no checkout, CI, headers de segurança (CSP etc.), dependências não relacionadas a segurança crítica (`postcss`, `sharp`). Esses ficam para os Blocos 2–5.

## Verificação de fim de bloco

1. `npm run build` limpo, `npx vitest run` com os testes novos passando.
2. Confirmar manualmente (Supabase Studio ou script) que `authenticated` não tem mais `EXECUTE` nas funções listadas.
3. Testar o fluxo de checkout completo (reserva → pedido → comprovante) continua funcionando após a validação zod e o rate limit.
4. Confirmar que a senha antiga do superadmin não funciona mais.
