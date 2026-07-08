# 00 · Visão geral

## O que é

**LeadFarma** é uma plataforma **SaaS multi-tenant**: uma única aplicação atende **várias farmácias**, cada uma com seus dados totalmente isolados. Cada farmácia tem um **catálogo online white-label** (com a própria logo e nome) que o cliente acessa por um link e usa para montar um pedido enviado por **WhatsApp**.

- **LeadFarma** é a plataforma (a marca "por trás").
- **A farmácia** é o cliente do SaaS — tem seu painel e sua marca visível ao consumidor.
- **O consumidor** é o cliente final da farmácia — navega o catálogo, se identifica (nome/CPF/endereço), pede pelo WhatsApp e recebe comprovante.

## As três superfícies

| Superfície | Rota | Público | Papel exigido |
|---|---|---|---|
| **Catálogo público** | `/f/[slug]` | consumidor final | nenhum (anônimo) |
| **Painel da farmácia** | `/painel` | dono/operador da farmácia | `pharmacy_admin` |
| **Gestão LeadFarma** | `/gestao` | operação da plataforma (você) | `superadmin` |

Cada farmácia é identificada por um **slug** na URL do catálogo (ex.: `/f/farmacia-teste`). O isolamento entre farmácias é garantido no banco por **RLS** (Row Level Security) — ver [02 · Banco de dados](./02-BANCO-DE-DADOS.md).

Além dessas três, existe a rota pública `/cadastro`, onde qualquer farmácia se auto-cadastra e ganha 14 dias de teste grátis (Fase 5) — ver [04 · Superfícies e rotas](./04-SUPERFICIES-E-ROTAS.md).

## Para quem / proposta de valor

Farmácias que querem um catálogo digital simples e com a própria marca, sem precisar de e-commerce completo: o pedido é fechado e enviado por WhatsApp, onde a farmácia conclui a venda. O cliente final se cadastra (com autorização LGPD) e a farmácia emite comprovante A4 ou cupom térmico. O sistema é pensado para ser **leve, rápido, simples, minimalista e profissional**.

## Roadmap (7 fases)

O sistema é construído **uma fase por vez**, cada uma com spec → plano → build → validação (ver [`docs/superpowers/`](./superpowers/)).

| Fase | Escopo | Status |
|---|---|---|
| **0** | Fundação multi-tenant, 3 superfícies, auth por papéis, onboarding, identidade LeadFarma | ✅ **concluída** |
| **1** | Produto de farmácia (EAN, marca/laboratório, preço unitário + faixa por qtd, apresentação/dosagem, precisa-de-receita) | ✅ **concluída** |
| **2** | Checkout + cliente (nome/CPF/celular/endereço, autofill por CPF com histórico versionado, consentimento LGPD) | ✅ **concluída** |
| **3** | Comprovantes A4 (PDF) + 58mm (térmica) + texto, com dados cadastrais da farmácia | ✅ **concluída** |
| **4** | PWA instalável white-label (manifest dinâmico, logo/nome/URL por farmácia) | ✅ **concluída** |
| **5** | Onboarding self-service + cobrança/assinaturas via **ASAAS** | ✅ **concluída** (scaffold pronto; cobrança real pendente de credenciais ASAAS) |
| **6** | Analytics (ticket médio, mais vendidos, sazonalidade por dia/horário) | ✅ **concluída** |

### O que cada fase entregou

- **Fase 0 — Fundação:** multi-tenancy no banco (isolamento RLS testado), as três superfícies funcionando, autenticação por papéis, cadastro obrigatório da farmácia, identidade visual LeadFarma (laranja/branco).
- **Fase 1 — Produto de farmácia:** `products` ganhou `brand` (marca/laboratório) e `requires_prescription` (selo "Exige receita"); a UI de produto e o catálogo usam vocabulário de farmácia — **Apresentação**/**Dosagem** (nas colunas físicas `size`/`color`, reaproveitadas — não renomeadas no banco), **preço unitário** (`price_retail`) e **preço por quantidade / a partir de N un.** (`price_wholesale` + `wholesale_threshold`); storage público `produtos` para fotos.
- **Fase 2 — Checkout + cliente + LGPD:** cadastro de cliente por farmácia (`customers`) com **histórico versionado** (`customer_history`), CPF validado, autofill por CEP (ViaCEP) e por CPF (busca anônima escopada à farmácia), **consentimento LGPD obrigatório** para salvar o cadastro; o pedido sempre grava um **snapshot** do cliente (CPF/endereço) independente do consentimento. Painel `/painel/clientes`.
- **Fase 3 — Comprovantes:** módulo `lib/receipts/` gera comprovante **A4** (PDF), **cupom térmico 58mm** (PDF) e **texto** para copiar/colar, todos com os dados cadastrais da farmácia (razão social, CNPJ, endereço, farmacêutico responsável/CRF) e do cliente (CPF/endereço).
- **Fase 4 — PWA white-label:** catálogo e painel são instaláveis como app (manifest dinâmico por farmácia/por sessão, service worker, ícones gerados por script).
- **Fase 5 — Onboarding + ASAAS:** auto-cadastro público (`/cadastro`, 14 dias grátis), planos (`trial`/`basic`/`pro`), scaffold de cobrança via **ASAAS** ativado por variável de ambiente (sem chave = modo manual/teste, nada quebra).
- **Fase 6 — Analytics:** relatório de vendas por farmácia (`/painel/relatorios`) com faturamento, ticket médio, mais vendidos, por categoria, por mês, por dia da semana e por horário.

### Dívidas conhecidas (não bloqueiam o uso, ver [06](./06-MANUTENCAO-E-ROADMAP.md))

A **reserva de estoque no carrinho** (`cart_reservations`) — cuja remoção estava prevista para a Fase 2 — foi **mantida** (adiada; o checkout novo não mexeu nesse mecanismo). A **busca de cliente por CPF** no checkout expõe PII escopada à farmácia (aceitável na escala atual; revisar se o SaaS crescer). A **cobrança via ASAAS** está com o código pronto mas **sem credenciais** — farmácias novas nascem em `trial`/`trialing` e a plataforma opera hoje em modo manual/teste de cobrança.
