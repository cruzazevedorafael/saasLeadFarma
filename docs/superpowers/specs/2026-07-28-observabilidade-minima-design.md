# LeadFarma — Observabilidade Mínima (Bloco 2 de 5) — Design

**Data:** 2026-07-28
**Bloco:** 2 de 5 do programa "sistema completo pensando em escala". Anterior: 1 Fundação de Segurança (concluído, mesclado). Próximos: 3 Ciclo de vida de assinatura automático · 4 Compliance de receita · 5 Confiabilidade operacional.

## Contexto

Hoje, se algo falhar em produção — um erro de banco na hora de fechar um pedido, uma falha ao processar um webhook de pagamento — **ninguém fica sabendo**. Os únicos registros são `console.error` espalhados em alguns pontos do código, visíveis só se alguém entrar manualmente nos Function Logs da Vercel. Não há alerta, não há agregação, não há como saber que algo quebrou sem o cliente reclamar primeiro.

Decisão do usuário, após comparar as duas abordagens (notificação direta nos 2 pontos críticos vs. Sentry completo): **Sentry**, mesmo custando mais setup agora, porque cobre qualquer erro automaticamente (não só os pontos que formos lembrar de instrumentar) e traz histórico/agrupamento — investimento que compensa conforme mais farmácias entrarem.

## 1. Provisionamento (Vercel Marketplace)

Confirmado via `vercel integration discover "sentry"` que o Sentry é uma integração nativa do Vercel Marketplace (categoria observability), com plano gratuito. Passos que só o usuário consegue fazer (exigem login interativo):

```bash
vercel link                                  # associa este projeto à conta Vercel
vercel integration add sentry --yes          # provisiona; pode abrir o navegador pra "claim" da conta Sentry
vercel env pull --yes                        # traz SENTRY_DSN / SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN pro .env.local
```

Depois de provisionado, no painel do Sentry (não é código): criar uma regra de alerta "notificar por e-mail quando um Issue novo aparecer" — 2 cliques, escopo desse bloco documenta o passo mas não pode executá-lo.

## 2. SDK `@sentry/nextjs`

Instalação padrão via `npx @sentry/wizard@latest -i nextjs` (gera `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`/`instrumentation.ts`, e ajusta `next.config.mjs` com `withSentryConfig`). Configuração deliberadamente mínima pro estágio atual:

- **Só captura de erro** — `tracesSampleRate: 0` (sem performance tracing), sem Session Replay. Evita consumir cota gratuita com dado que não vamos olhar agora.
- **Só em produção** — `enabled: process.env.NODE_ENV === 'production'` em cada config file, pra não poluir o Sentry com erro de ambiente de desenvolvimento.
- **Filtro de PII (`beforeSend`)** — hook único, centralizado num helper (`lib/sentry-scrub.ts` ou direto nos config files), que remove/mascara antes de qualquer envio: `customer_cpf`, `customer_phone`, `customer_cep`, `customer_logradouro`, `customer_numero`, `customer_complemento`, `customer_bairro` — em qualquer nível do evento (extra context, breadcrumbs, request body). Mantém: mensagem de erro, stack trace, nome de função/arquivo, `pharmacy_id`, `order_id`/`order_number` (identificadores, não dado pessoal — suficientes pra achar o registro completo no Supabase depois).

## 3. Captura explícita nos dois pontos críticos

Automático não basta aqui: `criarPedido` (`app/_actions/criar-pedido.ts`) e o webhook do Asaas (`app/api/asaas/webhook/route.ts`) capturam a própria exceção de propósito (pra devolver mensagem amigável / responder 200 corretamente pro Asaas) — o Sentry automático nunca vê esse erro porque ele nunca "escapa". Adicionar `Sentry.captureException(e, { extra: { pharmacyId, orderId } })` (sem PII do cliente, só identificadores) em cada `catch` já existente, mantendo o `console.error` atual como está (não remove nada, só soma).

## 4. Telas de erro (`error.tsx` / `not-found.tsx`)

Três pares, cada um chamando `Sentry.captureException(error)` no `useEffect` do `error.tsx` (padrão recomendado pela própria Sentry pra error boundaries do App Router):

- `app/error.tsx` + `app/not-found.tsx` — fallback genérico do site institucional, com a identidade visual já usada na landing (fundo claro, logo, botão "Tentar de novo" / "Voltar ao início").
- `app/f/[slug]/error.tsx` + `app/f/[slug]/not-found.tsx` — o mais importante (cliente final no meio de uma compra). Mensagem tranquilizadora ("não foi você, foi a gente"), botão de tentar de novo. `not-found.tsx` cobre slug de farmácia inexistente/inativa.
- `app/painel/error.tsx` — fundo escuro (`bg-ink`, consistente com o header do painel já recolorido no Bloco 1), mensagem pra dona da farmácia, botão de voltar ao painel. Sem `not-found.tsx` dedicado aqui (rotas do painel são sempre internas/autenticadas, o 404 genérico da raiz já serve).

## Fora de escopo deste bloco

Performance tracing, Session Replay, alertas para além do e-mail padrão do Sentry (Slack/PagerDuty etc. — sem necessidade com só um usuário respondendo), dashboards customizados.

## Verificação de fim de bloco

1. `npm run build` limpo com o SDK instalado.
2. Provocar um erro deliberado em ambiente de preview (ex: uma Server Action que lança exceção de teste) e confirmar que aparece no Sentry com o `pharmacy_id`/`order_id` mas **sem** CPF/telefone/endereço.
3. Confirmar visualmente as 3 telas de erro (forçar erro em cada segmento) — identidade visual correta, sem vazar stack trace pro usuário final.
4. Confirmar que o e-mail de alerta chega quando um Issue novo é criado no Sentry.
