# LeadFarma — Fase 0: Fundação Multi-tenant + Identidade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o app single-store (Karolla Fit) na fundação multi-tenant do LeadFarma: três superfícies (catálogo público, painel da farmácia, gestão LeadFarma), schema com isolamento por farmácia (RLS), autenticação por papéis, onboarding obrigatório e identidade visual LeadFarma.

**Architecture:** Next.js App Router + Supabase (Postgres + Auth). Multi-tenancy por `pharmacy_id` em todas as tabelas de negócio, isolado por RLS via funções `security definer` (`current_pharmacy_id()`, `is_superadmin()`). O antigo `store_settings` singleton vira a tabela `pharmacies` (o tenant). Resolução de tenant no catálogo por **slug na URL** (`/f/[slug]`); painel/gestão resolvem pelo `profiles` do usuário logado.

**Tech Stack:** Next.js, TypeScript, @supabase/ssr, @supabase/supabase-js, Zod, react-hook-form, Tailwind, vitest. Supabase project `emfraxjwxkvaxnvkubpz`.

## Global Constraints

- **Isolamento total entre farmácias** — nenhuma query de tenant pode retornar dados de outra farmácia; garantido por RLS desde a migration inicial.
- **Segredos só em `.env.local`** (fora do git). `service_role`/PAT nunca em arquivo versionado.
- **Papéis:** `'superadmin'` (LeadFarma) e `'pharmacy_admin'` (farmácia). Strings exatas.
- **Rotas:** catálogo `'/f/[slug]'` · painel farmácia `'/painel'` · gestão `'/gestao'`.
- **Sem branding "Karolla"/"Karolla Fit"** em nenhum arquivo ao final (verificável por grep).
- **Paleta LeadFarma:** base branca; azul/verde saúde; **laranja** como cor de ação/destaque. Sem o tema fitness escuro + verde-limão `#CFFF04`.
- **Produtos/pedidos mantêm a forma atual nesta fase** (só ganham `pharmacy_id`). Reshape de farmácia é Fase 1.
- **Credenciais super-admin:** `leadfarma.br@gmail.com` / `Projetarcode321@`.
- Commits frequentes, um por tarefa concluída.

---

## Estrutura de arquivos (o que será criado/alterado)

**Banco (`supabase/migrations/`):**
- `supabase/migrations/_karolla_archive/` — mover para cá as 16 migrations Karolla (referência histórica; fora do caminho de aplicação).
- Create `0001_pharmacies_profiles.sql` — tenant + auth + helpers RLS.
- Create `0002_catalog_e_negocio_tenant.sql` — tabelas de negócio tenant-izadas + views públicas por slug + RLS.

**Auth/tenant (código):**
- Create `lib/auth/session.ts` — leitura de sessão + profile.
- Create `lib/auth/guards.ts` — guards por papel + pharmacy corrente.
- Create `lib/data/pharmacy.ts` — data-layer da farmácia (por slug / por id / update).
- Modify `middleware.ts` — roteamento por papel + gate de onboarding.
- Modify `lib/data/settings.ts` — deprecado/reapontado para `pharmacy.ts`.

**Superfícies:**
- Create `app/f/[slug]/page.tsx` — catálogo público por tenant.
- Modify `app/page.tsx` — raiz vira landing simples do LeadFarma.
- Modify `app/painel/**` — tenant-scoping via guards; ler marca de `pharmacies`.
- Create `app/painel/cadastro/page.tsx` + `actions.ts` — onboarding obrigatório.
- Create `app/gestao/page.tsx`, `app/gestao/actions.ts`, `app/gestao/_components/*` — gestão LeadFarma.
- Create `app/gestao/layout.tsx` — guard superadmin.

**Identidade:**
- Modify `app/globals.css` / tema — tokens LeadFarma.
- Modify `app/layout.tsx`, `components/header.tsx`, `components/hero.tsx`, `components/cart.tsx` — remover "Karolla", usar marca da farmácia + "powered by LeadFarma".

**Seed/setup:**
- Create `scripts/seed-fase0.mjs` — cria superadmin, farmácia de teste e seu login via service_role/Management API. (Não versionar segredos; lê de `.env.local`.)

---

## Task 1: Schema base multi-tenant (pharmacies, profiles, RLS helpers)

**Agente sugerido:** `banco-dados`.

**Files:**
- Create: `supabase/migrations/0001_pharmacies_profiles.sql`
- Move: `supabase/migrations/000*_*.sql` (as 16 Karolla) → `supabase/migrations/_karolla_archive/`

**Interfaces (Produces):**
- Tabela `public.pharmacies` com colunas: `id uuid pk default gen_random_uuid()`, `slug text unique not null`, `razao_social text`, `nome_fantasia text`, `cnpj text`, `cep text`, `logradouro text`, `numero text`, `bairro text`, `cidade text`, `uf text`, `telefone text`, `email text`, `farmaceutico_responsavel text`, `crf text`, `logo_url text`, `nome_exibicao text`, `whatsapp_number text not null default ''`, `banner_image_url text`, `status text not null default 'active' check (status in ('active','suspended'))`, `onboarding_completed boolean not null default false`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- Tabela `public.profiles`: `id uuid pk references auth.users(id) on delete cascade`, `pharmacy_id uuid references public.pharmacies(id) on delete cascade`, `role text not null check (role in ('superadmin','pharmacy_admin'))`, `created_at timestamptz not null default now()`.
- Função `public.current_pharmacy_id() returns uuid` (stable, security definer).
- Função `public.is_superadmin() returns boolean` (stable, security definer).

- [ ] **Step 1: Mover as migrations Karolla para arquivo**

```bash
mkdir -p supabase/migrations/_karolla_archive
git mv supabase/migrations/00*_*.sql supabase/migrations/_karolla_archive/
```

- [ ] **Step 2: Escrever `0001_pharmacies_profiles.sql`**

```sql
-- 0001_pharmacies_profiles.sql — Fundação multi-tenant LeadFarma

create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  -- cadastro legal (obrigatório no onboarding; também alimenta comprovantes)
  razao_social text, nome_fantasia text, cnpj text,
  cep text, logradouro text, numero text, bairro text, cidade text, uf text,
  telefone text, email text,
  farmaceutico_responsavel text, crf text,
  -- marca visível ao cliente
  logo_url text, nome_exibicao text,
  -- operação
  whatsapp_number text not null default '',
  banner_image_url text,
  -- plataforma
  status text not null default 'active' check (status in ('active','suspended')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete cascade,
  role text not null check (role in ('superadmin','pharmacy_admin')),
  created_at timestamptz not null default now()
);

-- Helpers de tenant (security definer: leem profiles ignorando RLS)
create or replace function public.current_pharmacy_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select pharmacy_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_superadmin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
$$;

alter table public.pharmacies enable row level security;
alter table public.profiles enable row level security;

-- pharmacies: superadmin tudo; farmácia lê/edita a própria
create policy "pharmacies superadmin all" on public.pharmacies
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "pharmacies self read" on public.pharmacies
  for select to authenticated using (id = public.current_pharmacy_id());
create policy "pharmacies self update" on public.pharmacies
  for update to authenticated using (id = public.current_pharmacy_id()) with check (id = public.current_pharmacy_id());
-- anon lê dados públicos da farmácia (marca/whatsapp) por slug — necessário no catálogo
create policy "pharmacies anon read" on public.pharmacies
  for select to anon using (status = 'active');

-- profiles: cada um lê o próprio; superadmin lê todos
create policy "profiles self read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_superadmin());
create policy "profiles superadmin write" on public.profiles
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
```

- [ ] **Step 3: Validar SQL localmente (parse)**

Rodar via Management API num projeto/branch de teste OU revisar sintaxe. Expected: sem erro de sintaxe. (Aplicação real é a Task 3.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): schema base multi-tenant (pharmacies, profiles, RLS helpers)"
```

---

## Task 2: Tenant-izar tabelas de negócio + views públicas por slug

**Agente sugerido:** `banco-dados`.

**Files:**
- Create: `supabase/migrations/0002_catalog_e_negocio_tenant.sql`

**Interfaces (Consumes):** `pharmacies`, `current_pharmacy_id()`, `is_superadmin()` da Task 1.
**Interfaces (Produces):** todas as tabelas de negócio do sistema atual, recriadas **com `pharmacy_id uuid not null references public.pharmacies(id) on delete cascade`** e RLS por tenant; views públicas parametrizadas por slug.

Tabelas a portar (forma atual das migrations arquivadas, + `pharmacy_id`, **sem** `store_settings` e **sem** `cart_reservations`/reserva):
`products`, `product_variants`, `product_photos` (multifotos), `categories`, `shipping_methods`, `payment_methods`, `orders`, `order_items`.

**Padrão por tabela:**
```sql
-- exemplo (products)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  code text not null,
  -- ...demais colunas idênticas à migration Karolla arquivada...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacy_id, code)   -- code único POR farmácia, não global
);
alter table public.products enable row level security;
create policy "products tenant all" on public.products for all to authenticated
  using (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin())
  with check (pharmacy_id = public.current_pharmacy_id() or public.is_superadmin());
```
> Repetir o padrão para cada tabela. Chaves únicas antes globais (ex.: `products.code`) passam a ser **únicas por `pharmacy_id`**.

**Views públicas por slug** (anon lê o catálogo de UMA farmácia):
```sql
create view public.public_products with (security_invoker = false) as
  select p.id, p.pharmacy_id, ph.slug, p.code, p.name, p.category, p.description,
         p.image_url, p.price_wholesale, p.price_retail, p.min_wholesale, p.sort_order
  from public.products p
  join public.pharmacies ph on ph.id = p.pharmacy_id
  where p.active = true and ph.status = 'active';
grant select on public.public_products to anon;
-- idem public_product_variants (com pharmacy_id/slug e available = stock>0)
```

- [ ] **Step 1:** Escrever `0002_catalog_e_negocio_tenant.sql` portando cada tabela com o padrão acima (copiar colunas exatas das migrations arquivadas em `_karolla_archive/`).
- [ ] **Step 2:** Escrever as views públicas (`public_products`, `public_product_variants`) filtrando por `status='active'` e expondo `slug`, e `grant select ... to anon`.
- [ ] **Step 3:** Revisar: nenhuma tabela de negócio sem `pharmacy_id`; nenhuma policy que permita cross-tenant.
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_catalog_e_negocio_tenant.sql
git commit -m "feat(db): tabelas de negócio tenant-izadas + views públicas por slug"
```

---

## Task 3: Aplicar no Supabase + seed (superadmin, farmácia de teste, logins)

**Agente sugerido:** execução direta (usa `.env.local`).

**Files:**
- Create: `scripts/seed-fase0.mjs`

**Interfaces (Consumes):** schema das Tasks 1–2; `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` de `.env.local`.
**Interfaces (Produces):** banco aplicado; usuário `leadfarma.br@gmail.com` (superadmin) + `profiles`; farmácia de teste `slug='farmacia-teste'` + seu login `farmaciateste@leadfarma.br` + `profiles(pharmacy_admin)`.

- [ ] **Step 1:** Aplicar `0001` e `0002` no projeto `emfraxjwxkvaxnvkubpz` via Management API (`POST /v1/projects/{ref}/database/query`) lendo o SQL dos arquivos.
- [ ] **Step 2:** Verificar tabelas criadas: `select table_name from information_schema.tables where table_schema='public'` → contém `pharmacies`, `profiles`, `products`, etc.
- [ ] **Step 3:** `scripts/seed-fase0.mjs`:
  - cria usuário Auth `leadfarma.br@gmail.com` (senha `Projetarcode321@`, `email_confirm:true`) via `POST /auth/v1/admin/users` (service_role); insere `profiles(id=<uid>, pharmacy_id=null, role='superadmin')`.
  - cria `pharmacies(slug='farmacia-teste', nome_fantasia='Farmácia Teste', nome_exibicao='Farmácia Teste', whatsapp_number='', status='active', onboarding_completed=false)`.
  - cria usuário Auth `farmaciateste@leadfarma.br` (senha de teste) + `profiles(pharmacy_id=<farmacia>, role='pharmacy_admin')`.
- [ ] **Step 4:** Rodar `node scripts/seed-fase0.mjs`. Expected: imprime os UIDs criados; re-execução é idempotente (ignora "já existe").
- [ ] **Step 5:** Verificar login: `POST /auth/v1/token?grant_type=password` com o superadmin → recebe `access_token`.
- [ ] **Step 6: Commit** (só o script, sem segredos)

```bash
git add scripts/seed-fase0.mjs
git commit -m "chore(db): aplica schema fase 0 + seed superadmin e farmácia de teste"
```

---

## Task 4: Camada de auth/tenant no código

**Agente sugerido:** `backend-api`.

**Files:**
- Create: `lib/auth/session.ts`, `lib/auth/guards.ts`
- Test: `lib/auth/guards.test.ts`

**Interfaces (Produces):**
```ts
// lib/auth/session.ts
export type Role = 'superadmin' | 'pharmacy_admin'
export interface SessionProfile { userId: string; role: Role; pharmacyId: string | null }
export async function getSessionProfile(): Promise<SessionProfile | null>

// lib/auth/guards.ts
export async function requireSuperadmin(): Promise<SessionProfile>          // redirect('/painel/login') se não for
export async function requirePharmacyAdmin(): Promise<SessionProfile>       // redirect p/ login ou /painel/cadastro se onboarding incompleto
export async function getCurrentPharmacy(): Promise<import('@/lib/data/pharmacy').Pharmacy>
```

- [ ] **Step 1: Teste** (`guards.test.ts`): dado profile pharmacy_admin com `onboarding_completed=false`, `requirePharmacyAdmin()` chama `redirect('/painel/cadastro')`; superadmin em `requirePharmacyAdmin()` é redirecionado para `/gestao`. (Mockar `getSessionProfile`, `getCurrentPharmacy` e `next/navigation` redirect.)
- [ ] **Step 2:** Rodar o teste → FALHA (módulos não existem).
- [ ] **Step 3:** Implementar `session.ts` (usa `createClient` de `@/lib/supabase/server`, `auth.getUser()` → busca `profiles`) e `guards.ts`.
- [ ] **Step 4:** `pnpm test lib/auth` → PASSA.
- [ ] **Step 5: Commit** `feat(auth): sessão, papéis e guards de tenant`.

---

## Task 5: Middleware por papel + gate de onboarding

**Agente sugerido:** `backend-api`.

**Files:** Modify `middleware.ts`

**Interfaces (Consumes):** `getSessionProfile` (ou releitura de profile no edge via anon client).

Regras:
- `/gestao/**` exige `role='superadmin'`; senão → `/painel/login`.
- `/painel/**` exige `role='pharmacy_admin'`; superadmin → `/gestao`; anônimo → `/painel/login`. Se `pharmacy_admin` e `onboarding_completed=false` e rota ≠ `/painel/cadastro` → `/painel/cadastro`.
- `matcher`: `['/painel/:path*', '/gestao/:path*']`.

- [ ] **Step 1:** Reescrever `middleware.ts` renovando sessão (como hoje) e aplicando as regras acima (buscando `profiles` por `auth.getUser()`).
- [ ] **Step 2:** Ajustar `config.matcher` para incluir `/gestao`.
- [ ] **Step 3:** Verificação manual pós-deploy local (Task 11).
- [ ] **Step 4: Commit** `feat(auth): roteamento por papel e gate de onboarding no middleware`.

---

## Task 6: Data-layer da farmácia (settings → pharmacies, tenant-scoped)

**Agente sugerido:** `backend-api`.

**Files:**
- Create: `lib/data/pharmacy.ts`
- Test: `lib/data/pharmacy.test.ts`
- Modify: `lib/data/settings.ts` (reapontar `getStoreSettings` para a farmácia corrente, mantendo a interface usada pelas telas; remover `reservationMinutes`)

**Interfaces (Produces):**
```ts
export interface Pharmacy {
  id: string; slug: string; nomeExibicao: string; logoUrl: string | null;
  whatsappNumber: string; bannerImageUrl: string | null;
  status: 'active' | 'suspended'; onboardingCompleted: boolean;
  // cadastro
  razaoSocial: string | null; nomeFantasia: string | null; cnpj: string | null;
  cep: string | null; logradouro: string | null; numero: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; telefone: string | null; email: string | null;
  farmaceuticoResponsavel: string | null; crf: string | null;
}
export async function getPharmacyBySlug(slug: string): Promise<Pharmacy | null>  // anon-safe
export async function getPharmacyById(id: string): Promise<Pharmacy | null>
export async function updatePharmacy(id: string, patch: Partial<Pharmacy>): Promise<void>
```

- [ ] **Step 1: Teste** — `mappers` de linha do banco → `Pharmacy` (snake→camel), incluindo `onboardingCompleted`.
- [ ] **Step 2:** FALHA.
- [ ] **Step 3:** Implementar `pharmacy.ts`; reescrever `getStoreSettings()` para `getCurrentPharmacy()`-based (nome/whatsapp/banner/threshold default).
- [ ] **Step 4:** `pnpm test lib/data/pharmacy` → PASSA.
- [ ] **Step 5: Commit** `feat(data): data-layer da farmácia (tenant-scoped)`.

---

## Task 7: Catálogo público por tenant (`/f/[slug]`)

**Agente sugerido:** `frontend-final`.

**Files:**
- Create: `app/f/[slug]/page.tsx`
- Modify: `app/page.tsx` (raiz → landing simples LeadFarma com CTA), `lib/data/products.ts` (aceitar `slug`/`pharmacyId` nas queries públicas)

**Interfaces (Consumes):** `getPharmacyBySlug`, views `public_products`/`public_product_variants` (filtráveis por slug).

- [ ] **Step 1:** `getPublicProducts(slug)` filtra a view por `slug`. `app/f/[slug]/page.tsx` resolve a farmácia (404 se inexistente/suspensa), passa marca (logo/nome) + produtos para `<Catalog>`.
- [ ] **Step 2:** `app/page.tsx` vira landing mínima do LeadFarma (o catálogo não mora mais na raiz).
- [ ] **Step 3:** Verificação: `/f/farmacia-teste` renderiza com o nome da farmácia. (manual, Task 11)
- [ ] **Step 4: Commit** `feat(catálogo): vitrine pública por tenant em /f/[slug]`.

---

## Task 8: Painel tenant-scoped + onboarding obrigatório

**Agente sugerido:** `frontend-final` (+ `backend-api` nas actions).

**Files:**
- Modify: `app/painel/layout.tsx` e páginas `app/painel/**` — trocar checagens `auth.getUser()` avulsas por `requirePharmacyAdmin()`; todas as queries passam a ser tenant-scoped (RLS já força, mas inserts precisam setar `pharmacy_id = getCurrentPharmacy().id`).
- Create: `app/painel/cadastro/page.tsx`, `app/painel/cadastro/actions.ts`
- Modify: `app/painel/_components/banner-settings.tsx` e `settings-actions.ts` → gravam em `pharmacies`.

**Onboarding:** formulário com os campos obrigatórios (`razao_social, nome_fantasia, cnpj, cep, logradouro, numero, bairro, cidade, uf, telefone, email, farmaceutico_responsavel, crf, whatsapp_number`) validados por Zod; ao salvar com sucesso → `onboarding_completed=true` e redireciona para `/painel`.

- [ ] **Step 1: Teste** do schema Zod de cadastro (campos obrigatórios rejeitam vazio; cnpj com máscara aceita).
- [ ] **Step 2:** FALHA.
- [ ] **Step 3:** Implementar form + action (`updatePharmacy` + set onboarding). Aplicar `requirePharmacyAdmin()` no layout do painel e nas actions de escrita (setando `pharmacy_id`).
- [ ] **Step 4:** `pnpm test` do schema → PASSA.
- [ ] **Step 5: Commit** `feat(painel): tenant-scoping + onboarding obrigatório da farmácia`.

---

## Task 9: Gestão LeadFarma (`/gestao`)

**Agente sugerido:** `frontend-final` + `backend-api`.

**Files:**
- Create: `app/gestao/layout.tsx` (guard `requireSuperadmin()`), `app/gestao/page.tsx` (lista de farmácias), `app/gestao/actions.ts`, `app/gestao/_components/nova-farmacia-form.tsx`

**Ações (server, via `createAdminClient()` service_role):**
```ts
// app/gestao/actions.ts
export async function criarFarmacia(input: { nomeFantasia: string; slug: string; emailAdmin: string; senhaAdmin: string }): Promise<{ pharmacyId: string }>
export async function alternarStatus(pharmacyId: string, status: 'active' | 'suspended'): Promise<void>
```
`criarFarmacia`: insere `pharmacies` (status active, onboarding false) → cria usuário Auth do admin → insere `profiles(pharmacy_id, role='pharmacy_admin')`. Slug validado (kebab, único).

- [ ] **Step 1: Teste** — validação de slug (kebab-case, sem espaços) e do input de `criarFarmacia` (Zod).
- [ ] **Step 2:** FALHA.
- [ ] **Step 3:** Implementar layout+guard, listagem (nome, slug, status, data), form "nova farmácia", `criarFarmacia`, `alternarStatus`.
- [ ] **Step 4:** `pnpm test` → PASSA.
- [ ] **Step 5: Commit** `feat(gestão): painel LeadFarma — criar/listar/suspender farmácias`.

---

## Task 10: Identidade LeadFarma (tema + remoção de branding Karolla)

**Agente sugerido:** `direcao-criativa` (paleta) + `frontend-final` (aplicação).

**Files:** Modify `app/globals.css` (tokens de cor/tema), `app/layout.tsx` (metadata → "LeadFarma"), `components/header.tsx`, `components/hero.tsx`, `components/cart.tsx`, `app/painel/login/page.tsx`, e qualquer string "Karolla".

- [ ] **Step 1:** Definir tokens: base branca; **laranja LeadFarma** (ação/destaque), azul/verde saúde (apoio), texto neutro escuro. Substituir `#CFFF04` e o fundo escuro fitness.
- [ ] **Step 2:** Header/hero do catálogo passam a exibir `logo_url` + `nome_exibicao` da farmácia (prop vinda da page); rodapé com "powered by LeadFarma".
- [ ] **Step 3:** Metadata do app = LeadFarma; login e gestão com marca LeadFarma.
- [ ] **Step 4: Verificação:** `grep -rniE "karolla" app components lib` → **zero** ocorrências.
- [ ] **Step 5: Commit** `feat(identidade): tema LeadFarma e remoção do branding Karolla`.

---

## Task 11: Verificação de ponta a ponta (Fase 0)

**Agente sugerido:** `qa-testes` + `seguranca`.

**Files:** Create `docs/superpowers/plans/2026-07-07-fase0-verificacao.md` (checklist preenchido com resultados).

- [ ] **Step 1: Isolamento (RLS)** — logar como farmácia A (token), inserir produto; logar como farmácia B, `select` em `products` não retorna o produto de A. Expected: isolado.
- [ ] **Step 2: Papéis** — superadmin acessa `/gestao` (200); pharmacy_admin em `/gestao` → redirecionado; anônimo em `/painel` → `/painel/login`.
- [ ] **Step 3: Onboarding** — login da farmácia de teste (onboarding_completed=false) → forçado a `/painel/cadastro`; após salvar → `/painel`.
- [ ] **Step 4: Catálogo** — `/f/farmacia-teste` mostra a marca da farmácia; slug inexistente → 404.
- [ ] **Step 5: Build & typecheck** — `pnpm build` limpo; `pnpm test` verde; `grep -rniE "karolla"` → zero.
- [ ] **Step 6: Segurança** — sem segredos versionados (`git grep -iE "service_role|sbp_|SUPABASE_SERVICE"` só em `.env.local`/ignorados); RLS ativa em todas as tabelas de negócio.
- [ ] **Step 7: Commit** do checklist preenchido.

---

## Self-Review (cobertura do spec)

- Três superfícies → Tasks 5,7,8,9. ✅
- Modelo multi-tenant (pharmacies/profiles/pharmacy_id) → Tasks 1,2. ✅
- RLS/isolamento → Tasks 1,2,11. ✅
- Auth por papéis + onboarding → Tasks 4,5,8. ✅
- Identidade LeadFarma × farmácia → Tasks 7,10. ✅
- Aplicar Supabase + logins → Task 3. ✅
- store_settings → pharmacies → Tasks 1,6. ✅
- Fora de escopo (produto farmácia, checkout, comprovantes, PWA, ASAAS, analytics) → não há task (correto; fases seguintes). ✅
