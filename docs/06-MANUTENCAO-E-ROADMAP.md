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

- **Variações repurposadas:** as colunas físicas de `product_variants`/`order_items` seguem `size`/`color`, mas a UI/comprovantes as tratam como **Apresentação/Dosagem** (Fase 1). Renomear as colunas é opcional/futuro.
- **Reserva de estoque de carrinho** (`cart_reservations` + `reservar_item`/`liberar_*`) **ainda ativa**: a remoção estava prevista na Fase 2, mas foi **adiada** para não arriscar o fluxo que funciona. Cleanup opcional.
- **PII por CPF:** a action anônima `buscar-cliente` devolve o cadastro a partir do CPF (autofill do checkout). É enumerável — aceitável para farmácia pequena, **rever/proteger se escalar** (rate limit / fator extra). Escopo por farmácia + CPF válido já mitigam parcialmente.
- **ASAAS pendente de credenciais:** o código está pronto e **desligado** até `ASAAS_API_KEY` existir (modo manual/teste). Sem chave, nada quebra.
- **`order_number_seq` é global** (numeração de pedidos não é por-farmácia). Aceitável; rever se necessário.
- **Rotacionar** `service_role`/`PAT` do Supabase por precaução.
- **Correção aplicada (0006):** o anon do catálogo **não lê mais** as colunas cadastrais sensíveis de `pharmacies` (cnpj, email, telefone, farmacêutico, CRF, ids ASAAS) — grant restrito só às colunas públicas.

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

**Fases 0–6 concluídas** na branch `feat/leadfarma-fase-0` (ainda não mergeada na `main`). Build de produção limpo, **102 testes verdes**, isolamento RLS e fluxos verificados live no Supabase. Migrations `0001`–`0006` aplicadas. Ver [00 · Visão geral](./00-VISAO-GERAL.md) para o quadro de fases.

Falta o usuário decidir: **mergear** `feat/leadfarma-fase-0` na `main`, **ativar o ASAAS** (quando aprovado) e o **deploy na Vercel** (ver [05 · Setup](./05-SETUP-E-EXECUCAO.md)).
