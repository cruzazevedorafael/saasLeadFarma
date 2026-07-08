# 00 · Visão geral

## O que é

**LeadFarma** é uma plataforma **SaaS multi-tenant**: uma única aplicação atende **várias farmácias**, cada uma com seus dados totalmente isolados. Cada farmácia tem um **catálogo online white-label** (com a própria logo e nome) que o cliente acessa por um link e usa para montar um pedido enviado por **WhatsApp**.

- **LeadFarma** é a plataforma (a marca "por trás").
- **A farmácia** é o cliente do SaaS — tem seu painel e sua marca visível ao consumidor.
- **O consumidor** é o cliente final da farmácia — navega o catálogo e pede pelo WhatsApp.

## As três superfícies

| Superfície | Rota | Público | Papel exigido |
|---|---|---|---|
| **Catálogo público** | `/f/[slug]` | consumidor final | nenhum (anônimo) |
| **Painel da farmácia** | `/painel` | dono/operador da farmácia | `pharmacy_admin` |
| **Gestão LeadFarma** | `/gestao` | operação da plataforma (você) | `superadmin` |

Cada farmácia é identificada por um **slug** na URL do catálogo (ex.: `/f/farmacia-teste`). O isolamento entre farmácias é garantido no banco por **RLS** (Row Level Security) — ver [02 · Banco de dados](./02-BANCO-DE-DADOS.md).

## Para quem / proposta de valor

Farmácias que querem um catálogo digital simples e com a própria marca, sem precisar de e-commerce completo: o pedido é fechado e enviado por WhatsApp, onde a farmácia conclui a venda. O sistema é pensado para ser **leve, rápido, simples, minimalista e profissional**.

## Roadmap (7 fases)

O sistema é construído **uma fase por vez**, cada uma com spec → plano → build → validação (ver [`docs/superpowers/`](./superpowers/)).

| Fase | Escopo | Status |
|---|---|---|
| **0** | Fundação multi-tenant, 3 superfícies, auth por papéis, onboarding, identidade LeadFarma | ✅ **concluída** |
| **1** | Produto de farmácia (EAN, marca/laboratório, preço unitário + faixa por qtd, apresentação/dosagem, precisa-de-receita) | ⬜ próxima |
| **2** | Checkout + cliente (nome/CPF/celular/endereço, autofill por CPF com histórico versionado, consentimento LGPD) | ⬜ |
| **3** | Comprovantes A4 (PDF) + 58mm (térmica) + texto, com dados cadastrais da farmácia | ⬜ |
| **4** | PWA instalável white-label (manifest dinâmico, logo/nome/URL por farmácia) | ⬜ |
| **5** | Onboarding self-service + cobrança/assinaturas via **ASAAS** | ⬜ |
| **6** | Analytics (ticket médio, mais vendidos, sazonalidade por dia/horário) | ⬜ |

### O que a Fase 0 entregou (e o que ainda não)

**Entregou:** multi-tenancy no banco (isolamento RLS testado), as três superfícies funcionando, autenticação por papéis, cadastro obrigatório da farmácia, identidade visual LeadFarma (laranja/branco), remoção total do branding antigo, build de produção limpo e 91 testes verdes.

**Ainda não (fica para as próximas fases):** o **produto** ainda tem a forma herdada do app original (com variações tamanho/cor e preço atacado/varejo) — ganhou apenas `pharmacy_id`; o **reshape para farmácia** é a Fase 1. A **reserva de estoque** foi mantida e será removida na Fase 2. **Checkout com dados do cliente/LGPD, comprovantes, PWA, cobrança e analytics** são fases 2–6.
