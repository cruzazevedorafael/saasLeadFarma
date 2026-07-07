# LeadFarma — Fase 0: Fundação Multi-tenant + Identidade — Design

**Data:** 2026-07-07
**Fase:** 0 de 6 (fundação). As demais: 1 Catálogo+Painel · 2 Checkout+Cliente+LGPD · 3 Comprovantes · 4 PWA white-label · 5 Onboarding+ASAAS · 6 Analytics.

## Contexto

O código atual é o app **single-store** "Karolla Fit" (catálogo de moda fitness com painel admin e envio de pedido por WhatsApp). Vamos transformá-lo no **LeadFarma**: um **SaaS multi-tenant** de catálogo online para **farmácias**. Cada farmácia tem seu catálogo com a própria marca; o cliente monta um pedido e envia por WhatsApp.

Banco Supabase de destino (`emfraxjwxkvaxnvkubpz`) está **vazio** — nada aplicado ainda. Isso permite desenhar o schema limpo, já multi-tenant, sem migração de dados legada.

## Visão das três superfícies

O sistema tem **três frentes** distintas, com públicos e permissões diferentes:

| Superfície | Rota | Quem acessa | Papel |
|---|---|---|---|
| **Catálogo público** | `/f/[slug]` | Cliente final (anônimo) | vê produtos da farmácia, monta pedido, envia por WhatsApp |
| **Painel da Farmácia** | `/painel` | Admin da farmácia | cadastra produtos, configura loja, vê pedidos/clientes (só da sua farmácia) |
| **Gestão LeadFarma** | `/gestao` | Super-admin (nós) | cria/suspende farmácias, cria o login de cada uma, vê tudo |

## Escopo da Fase 0 (o que ENTRA)

A Fase 0 entrega a **fundação**: multi-tenancy, autenticação por papéis, o esqueleto das três superfícies, onboarding da farmácia e a identidade visual LeadFarma. As **funcionalidades ricas** (produto de farmácia, checkout, comprovantes etc.) ficam para as fases seguintes; aqui só garantimos que a base está correta e que o sistema roda por farmácia.

### 1. Modelo de dados multi-tenant

Schema novo, tenant-aware, aplicado ao Supabase de uma vez.

**`pharmacies`** (o tenant — 1 linha por farmácia). Absorve o antigo `store_settings` (que era singleton) e os dados cadastrais/legais da empresa:
- `id` uuid pk
- `slug` text unique — usado na URL pública (`/f/drogaria-x`)
- **Cadastrais (obrigatórios no onboarding):** `razao_social`, `nome_fantasia`, `cnpj`, `endereco` (cep, logradouro, numero, bairro, cidade, uf), `telefone`, `email`, `farmaceutico_responsavel`, `crf` (registro do farmacêutico)
- **Marca (cliente vê):** `logo_url`, `nome_exibicao` (default = nome_fantasia)
- **Operação:** `whatsapp_number`, `banner_image_url`
- **Plataforma:** `status` ('active' | 'suspended'), `onboarding_completed` boolean, `created_at`

> Os campos cadastrais legais também alimentarão os comprovantes A4/58mm (Fase 3).

**`profiles`** (liga o usuário do Supabase Auth à farmácia + papel):
- `id` uuid pk = `auth.users.id`
- `pharmacy_id` uuid null (null para super-admin) → `pharmacies.id`
- `role` text — 'superadmin' | 'pharmacy_admin'
- `created_at`

**Tabelas de negócio ganham `pharmacy_id`:** `products`, `product_variants` (mantêm a forma atual nesta fase — reshape de farmácia é Fase 1), com `pharmacy_id not null references pharmacies(id)`. O antigo `store_settings` é **removido** (virou `pharmacies`), e com ele saem `reservation_minutes` e a lógica de reserva.

### 2. Isolamento (RLS)

Funções `security definer`:
- `current_pharmacy_id()` → lê `pharmacy_id` do `profiles` do usuário logado.
- `is_superadmin()` → true se `role='superadmin'`.

Políticas nas tabelas tenant: acesso permitido quando `pharmacy_id = current_pharmacy_id()` **ou** `is_superadmin()`. `pharmacies`/`profiles`: farmácia lê/edita só a própria linha; super-admin lê/escreve tudo.

Catálogo público (anon): lê por **views seguras** filtradas pelo `slug` da farmácia (produtos ativos + disponibilidade), sem expor custo/estoque bruto — mesmo padrão de view `security_invoker=false` já usado hoje.

### 3. Autenticação e papéis

- **Super-admin** (`leadfarma.br@gmail.com`): login criado no Auth, `profiles.role='superadmin'`, sem `pharmacy_id`.
- **Admin de farmácia:** o super-admin cria a farmácia e o login dela na Gestão; no primeiro acesso a farmácia completa o cadastro (obrigatório) antes de usar o painel.
- **Middleware/guards:** decidem a superfície pelo papel — super-admin → `/gestao`; pharmacy_admin → `/painel`; anônimo → catálogo. Um pharmacy_admin com `onboarding_completed=false` é levado para a tela de cadastro.

### 4. Esqueleto das três superfícies

- **Catálogo público** (`/f/[slug]`): resolve a farmácia pelo slug e renderiza a vitrine tenant-scoped (reaproveita o `Catalog` atual). *A raiz `/` mostra uma landing simples do LeadFarma ou redireciona; definido no plano.*
- **Painel da Farmácia** (`/painel`): o painel atual, agora tenant-scoped (todas as queries via `current_pharmacy_id()`), lê marca/whatsapp de `pharmacies`.
- **Gestão LeadFarma** (`/gestao`): superfície nova e mínima nesta fase — listar farmácias, criar farmácia + login, suspender/reativar.

### 5. Identidade visual LeadFarma

- Paleta **saúde + marca**: base branca, tons de **azul/verde** (confiança/saúde) e **laranja LeadFarma** como cor de destaque/ação; visual limpo, minimalista, confortável.
- Tokens de cor centralizados (CSS vars / tema) — substituem o tema fitness (fundo escuro + verde-limão `#CFFF04`).
- **Remoção do branding Karolla** hardcoded (em `app/layout.tsx`, `components/header.tsx`, `components/hero.tsx`, `components/cart.tsx` e afins).
- **Identidade dupla:** cliente vê `logo_url` + `nome_exibicao` da farmácia; LeadFarma aparece no título do app, no painel de gestão e num "powered by LeadFarma" discreto no rodapé do catálogo.

### 6. Aplicação e dados iniciais

- Aplicar o schema no Supabase (`emfraxjwxkvaxnvkubpz`).
- Criar o super-admin `leadfarma.br@gmail.com` (senha fornecida) + `profiles`.
- Criar **1 farmácia de teste** + seu login, para validar o fluxo ponta a ponta.

## Fora de escopo (fases seguintes)

- Reshape do produto para farmácia (marca, EAN, receita, apresentação, preço/faixa) → **Fase 1**.
- Checkout com dados do cliente, autofill por CPF, consentimento LGPD, histórico por farmácia → **Fase 2**.
- Comprovantes A4 + 58mm + texto → **Fase 3**.
- PWA instalável white-label (manifest dinâmico, URL/logo/nome por farmácia) → **Fase 4**.
- Onboarding self-service + cobrança/assinaturas via **ASAAS** → **Fase 5**.
- Analytics (ticket médio, mais vendidos, sazonalidade) → **Fase 6**.

Nesta fase, `products`/`product_variants` mantêm a forma atual só para o sistema rodar; não investir em UI de produto de farmácia aqui.

## Riscos e decisões

- **Resolução de tenant por slug (path-based) agora; subdomínio/domínio próprio na Fase 4.** Evita mexer em DNS/hosting cedo.
- **`store_settings` → `pharmacies`:** simplifica (config é 1:1 com a farmácia) e evita uma tabela singleton num mundo multi-tenant. Exige refazer o data-layer `getStoreSettings()` para resolver por tenant.
- **RLS desde a migration inicial** (não deixar pra depois) — é o que garante o isolamento entre farmácias.
- **Segredos:** `.env.local` (fora do git). Rotacionar `service_role`/PAT depois do setup, por precaução.

## Testes (Fase 0)

- Isolamento: farmácia A não enxerga dados da farmácia B (RLS) — teste com dois tenants.
- Papéis: super-admin acessa `/gestao`; pharmacy_admin é barrado em `/gestao` e vai pra `/painel`; anônimo só vê catálogo.
- Onboarding: pharmacy_admin sem cadastro completo é forçado à tela de cadastro.
- Catálogo público resolve por slug e mostra marca da farmácia.
- Build e typecheck limpos; sem branding Karolla remanescente (grep).
