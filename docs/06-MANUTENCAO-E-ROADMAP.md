# 06 · Manutenção e roadmap

## Convenções do projeto

- **Multi-tenant sempre:** toda tabela nova de negócio tem `pharmacy_id NOT NULL` + política RLS de tenant. Todo insert seta `pharmacy_id = getCurrentPharmacyId()`. Toda leitura de painel usa o **client autenticado** (RLS isola sozinho); leitura pública usa view/filtro por `pharmacy_id`.
- **Escrita vs leitura:** escrita → `createAdminClient()` (service-role) setando `pharmacy_id` na mão. Leitura de painel → `createClient()` autenticado.
- **Guards nas páginas/actions** + **middleware** + **RLS**: três camadas. Nunca confie só no frontend.
- **Segredos** só em `.env.local`. Nada de chave em arquivo versionado.
- **Migrations versionadas** em `supabase/migrations/` (numeradas). Não editar migration já aplicada — criar uma nova.
- **Testes** acompanham a mudança (Vitest). `pnpm test` deve ficar verde.

## Como adicionar uma tabela de negócio (receita)

1. Nova migration `supabase/migrations/000X_....sql`: `create table` com `pharmacy_id uuid not null references pharmacies(id) on delete cascade`, `enable row level security` e a política padrão de tenant (ver [02](./02-BANCO-DE-DADOS.md)).
2. Aplicar (via Management API/script) e conferir.
3. Data-layer em `lib/data/…`: leitura de painel com client autenticado; se houver leitura pública, criar função/​view por `pharmacy_id`.
4. Server actions setando `pharmacy_id = getCurrentPharmacyId()`.
5. UI no painel; testes.

## Como adicionar uma farmácia (operação)

Pela **Gestão** (`/gestao` → "Nova farmácia"): informa nome, slug, e-mail e senha inicial. O sistema cria a farmácia + o login. A farmácia completa o cadastro no primeiro acesso.

## Pontos de atenção / dívidas conhecidas

- **Produto ainda no formato antigo** (variações tamanho/cor, preço atacado/varejo): reshape para farmácia é a **Fase 1**.
- **Reserva de estoque de carrinho** (`cart_reservations` + `reservar_item`/`liberar_*`) ainda ativa: **remover na Fase 2** (checkout novo).
- **`order_number_seq` é global** (numeração de pedidos não é por-farmácia). Aceitável; rever se necessário.
- **`wholesale_threshold`** em `pharmacies` é herança da regra de atacado; será revisto no modelo de preço da Fase 1/2.
- **Storage** (bucket `produtos` para fotos/banner) precisa existir no Supabase para uploads funcionarem — configurar quando entrar o cadastro de produto com foto (Fase 1).
- **Rotacionar** `service_role`/`PAT` do Supabase por precaução.

## Roadmap detalhado

| Fase | Entrega | Principais mudanças |
|---|---|---|
| **1 · Produto de farmácia** | Cadastro voltado a farmácia | Reshape `products` (marca/laboratório, EAN, `requires_prescription`, preço unitário + faixa por qtd), `product_variants` → apresentação/dosagem; storage de fotos; UI de cadastro |
| **2 · Checkout + cliente + LGPD** | Dados do cliente e histórico | Tabela de clientes por farmácia (nome/CPF/celular/endereço), autofill por CPF com **histórico versionado**, **consentimento LGPD**; remover reserva de carrinho |
| **3 · Comprovantes** | A4 + 58mm + texto | PDF A4 (base em `lib/order-pdf.ts`), layout térmico 58mm, texto organizado; puxar dados cadastrais da farmácia |
| **4 · PWA white-label** | App instalável por farmácia | `manifest` dinâmico (logo/nome/URL por farmácia), decisão subdomínio × domínio próprio |
| **5 · Onboarding + ASAAS** | SaaS comercial | Auto-cadastro de farmácia, planos e **cobrança/assinaturas via ASAAS** |
| **6 · Analytics** | Inteligência de vendas | Ticket médio, mais vendidos, categoria, sazonalidade (mês/dia da semana/horário) |

> Cada fase segue o ciclo **spec → plano → build → validação**, com os documentos em [`docs/superpowers/`](./superpowers/).

## Estado atual

**Fase 0 concluída** na branch `feat/leadfarma-fase-0` (ainda não mergeada na `main`). Build de produção limpo, 91 testes verdes, isolamento RLS verificado. Ver [00 · Visão geral](./00-VISAO-GERAL.md) para o quadro de fases.
