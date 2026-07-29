# LeadFarma — Ciclo de Vida de Assinatura Automático (Bloco 3 de 5) — Design

**Data:** 2026-07-29
**Bloco:** 3 de 5 do programa "sistema completo pensando em escala". Anteriores: 1 Fundação de Segurança (concluído, mesclado) · 2 Observabilidade Mínima (concluído, mesclado). Próximos: 4 Compliance de receita · 5 Confiabilidade operacional.

## Contexto

Hoje o ciclo de vida de assinatura é 100% manual: quando o trial de 14 dias vence ou um pagamento fica em atraso, **nada acontece sozinho** — a farmácia continua com acesso total ao painel até um superadmin entrar em `/gestao` e clicar "Suspender". Isso não escala além de um punhado de farmácias, e depende de alguém lembrar de verificar.

`pharmacies.status` (`active`/`suspended`, controla acesso) e `pharmacies.subscription_status` (`trialing`/`active`/`past_due`/`canceled`, reflete o Asaas) são hoje **campos totalmente desacoplados** — nada deriva um do outro. O webhook do Asaas (já reforçado no Bloco 1: fail-closed, `timingSafeEqual`, idempotente) já atualiza `subscription_status` corretamente, mas nunca toca em `status`.

## Decisões de negócio confirmadas com o usuário

- **Trial vencido:** suspende imediatamente, sem tolerância — o trial já é um prazo combinado desde o início (mostrado no próprio painel).
- **Pagamento atrasado (`past_due`/`canceled`):** 3 dias de tolerância antes de suspender de verdade — evita punir uma farmácia por uma falha pontual de cobrança que o Asaas ainda vai tentar de novo.
- **Reativação:** quando o pagamento é confirmado (`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`), reativa o acesso automaticamente — sem isso, a suspensão automática criaria um problema pior que o atual (farmácia paga e continua bloqueada até alguém notar).

## 1. Rastrear a origem da suspensão (novo)

Suspensão automática por falta de pagamento **não pode reativar sozinha** uma farmácia que o superadmin suspendeu manualmente por outro motivo (ex.: suspeita de fraude, violação de termos). Migration nova adiciona:

- `pharmacies.subscription_status_since timestamptz not null default now()` — quando `subscription_status` mudou pela última vez. Necessário porque `updated_at` muda por qualquer edição da farmácia (logo, cor, endereço) — não serve como relógio confiável pra contar os 3 dias de tolerância.
- `pharmacies.suspension_reason text` — `'trial_expired'` | `'payment_overdue'` | `null`. `null` = suspensão manual ou qualquer outro motivo. Só suspensão com `suspension_reason` preenchido pode ser reativada automaticamente pelo webhook.

## 2. Cron job diário

Nova rota `app/api/cron/verificar-assinaturas/route.ts`, protegida por `CRON_SECRET` (mesmo padrão fail-closed + `timingSafeEqual` já usado no webhook do Asaas — Vercel Cron envia `Authorization: Bearer $CRON_SECRET` automaticamente quando a env var existe).

Duas consultas, cada farmácia batendo em qualquer uma delas é suspensa (`status='suspended'`, `suspension_reason` conforme o motivo):
1. **Trial vencido:** `status='active' AND plan='trial' AND trial_ends_at IS NOT NULL AND trial_ends_at < now()` → `suspension_reason='trial_expired'`.
2. **Pagamento atrasado além da tolerância:** `status='active' AND subscription_status IN ('past_due','canceled') AND subscription_status_since < now() - interval '3 days'` → `suspension_reason='payment_overdue'`.

Agendamento via `vercel.ts` (formato atual recomendado, substitui `vercel.json`): `crons: [{ path: '/api/cron/verificar-assinaturas', schedule: '0 6 * * *' }]` — 1x por dia.

Erros no cron são reportados ao Sentry (já disponível desde o Bloco 2) — se a verificação falhar silenciosamente, ninguém mais fica sem saber.

## 3. Reativação automática no webhook do Asaas

`app/api/asaas/webhook/route.ts` (já existente): ao processar `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` (evento que já mapeia pra `subscription_status='active'`), se a farmácia afetada está `status='suspended'` **e** `suspension_reason` é `'trial_expired'` ou `'payment_overdue'` (nunca se for `null`/manual): também atualiza `status='active'` e limpa `suspension_reason`. Toda mudança de `subscription_status` (não só essa) também atualiza `subscription_status_since`.

## 4. `/gestao` — reativação manual

`alternarStatus` (`app/gestao/actions.ts`) ganha uma linha a mais: ao reativar (`status: 'active'`), também limpa `suspension_reason: null` — evita que um estado antigo de `payment_overdue` "grude" numa farmácia já reativada manualmente.

## Fora de escopo deste bloco

Notificação por e-mail pra farmácia avisando da suspensão (hoje ela já descobre ao tentar logar — a tela de login já mostra "farmácia suspensa, fale com o suporte"; e-mail proativo fica pro backlog). Qualquer mudança na UI de `/painel/assinatura` além do que já existe. Renegociação/reembolso automático.

## Verificação de fim de bloco

1. `npm run build` limpo, testes novos passando.
2. Aplicar a migration em produção e confirmar as duas colunas novas.
3. Configurar `CRON_SECRET` na Vercel e confirmar que o cron roda (checar o log da primeira execução agendada, ou disparar manualmente via `vercel cron trigger` / chamada HTTP direta com o secret certo).
4. Teste manual: criar uma farmácia de teste com `trial_ends_at` no passado, rodar o cron manualmente (chamada HTTP com o secret), confirmar que fica `suspended` com `suspension_reason='trial_expired'`.
5. Confirmar que suspensão manual (`suspension_reason=null`) não é afetada por um webhook de pagamento confirmado simulado.
