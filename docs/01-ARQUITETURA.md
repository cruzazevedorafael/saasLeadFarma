# 01 · Arquitetura

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions), Turbopack |
| Linguagem | TypeScript |
| Banco / Auth / Storage | **Supabase** (Postgres + Auth + Storage) |
| Acesso ao banco | `@supabase/ssr` (client autenticado por cookies) e `@supabase/supabase-js` (service-role) |
| Validação | Zod |
| Formulários | react-hook-form + `@hookform/resolvers` (onde aplicável) e forms controlados |
| UI | Tailwind CSS v4, componentes shadcn/ui (Radix), framer-motion, lucide-react |
| Estado (carrinho) | Zustand (persistido em localStorage) |
| Testes | Vitest + Testing Library (jsdom) |
| PDF | jsPDF (`lib/order-pdf.ts`) |

## Multi-tenancy (o conceito central)

Uma única aplicação e um único banco atendem várias farmácias. Cada **farmácia é um tenant**, representado por uma linha na tabela `pharmacies`. Toda tabela de negócio (produtos, pedidos, categorias, etc.) carrega uma coluna **`pharmacy_id`** e é protegida por **RLS** (Row Level Security): o Postgres só devolve/aceita linhas da farmácia do usuário logado. Detalhes em [02 · Banco de dados](./02-BANCO-DE-DADOS.md).

**Como cada requisição sabe "de qual farmácia" é:**
- **Catálogo público** (`/f/[slug]`): pelo **slug na URL** → resolve a farmácia por `getPharmacyBySlug()`.
- **Painel e Gestão**: pelo **usuário logado** → o `profiles` liga o usuário à farmácia e ao papel.

## Duas formas de acessar o banco

| Cliente | Arquivo | Quando usar | RLS |
|---|---|---|---|
| **Autenticado (anon key + cookies)** | `lib/supabase/server.ts` (`createClient`) | leituras do painel e do catálogo público | **respeita RLS** — isola por tenant automaticamente |
| **Admin (service-role)** | `lib/supabase/admin.ts` (`createAdminClient`) | escritas que precisam setar `pharmacy_id`, criação de usuários, operações de plataforma | **ignora RLS** — por isso o código filtra `pharmacy_id` na mão |
| **Browser** | `lib/supabase/client.ts` (`createClient`) | client components (raro) | respeita RLS |

> Regra de ouro: leitura de painel → **client autenticado** (RLS isola sozinho). Escrita → **admin client** setando `pharmacy_id = getCurrentPharmacyId()`.

## Estrutura de pastas

```
app/
  page.tsx                 landing institucional do LeadFarma
  layout.tsx               metadata + tema (html lang pt-BR)
  globals.css              tema Tailwind v4 (paleta laranja LeadFarma)
  f/[slug]/page.tsx        CATÁLOGO PÚBLICO por farmácia (anon)
  gestao/                  GESTÃO LeadFarma (superadmin)
    layout.tsx             guard requireSuperadmin
    page.tsx               lista de farmácias
    actions.ts             criarFarmacia / alternarStatus
    _components/           nova-farmacia-form, status-toggle
  painel/                  PAINEL DA FARMÁCIA (pharmacy_admin)
    page.tsx               home do painel
    login/                 login + logout (Supabase Auth)
    cadastro/              onboarding obrigatório da farmácia
    produtos/ categorias/ envio/ pagamento/ pedidos/   CRUDs
    settings-actions.ts    grava config da farmácia (pharmacies)
  _actions/                criar-pedido, reserva-carrinho (checkout público)
  _components/catalog.tsx  UI do catálogo (client)
components/                header, hero, cart, product-card, ui/ (shadcn)
lib/
  auth/                    session.ts (papel), guards.ts (guards por papel)
  data/                    camada de dados: pharmacy, products, categories,
                           shipping, payment, settings, mappers, *.helpers
  supabase/                server, admin, client
  order-pdf.ts             geração de PDF do pedido
middleware.ts              roteamento por papel + gate de onboarding
supabase/migrations/       schema versionado (0001, 0002; Karolla em _karolla_archive)
scripts/seed-fase0.mjs     aplica schema + cria superadmin/farmácia de teste
docs/                      esta documentação; specs/planos em docs/superpowers/
```

## Fluxo de uma requisição (exemplos)

**Cliente abre o catálogo `/f/farmacia-teste`:**
1. `app/f/[slug]/page.tsx` recebe o slug.
2. `getPharmacyBySlug(slug)` resolve a farmácia (404 se não existir/estiver suspensa).
3. `getPublicProducts(pharmacy.id)` + envio/pagamento públicos lêem as **views** `public_*` filtrando por `pharmacy_id`.
4. Renderiza `<Catalog>` com a **marca da farmácia** (logo/nome) e o rodapé "powered by LeadFarma".

**Farmácia acessa `/painel/produtos`:**
1. `middleware.ts` confere o papel (`pharmacy_admin`) e o gate de onboarding.
2. A página chama `requirePharmacyAdmin()` e lê produtos pelo **client autenticado** → RLS devolve só os da farmácia.
3. Uma edição chama uma **server action** que usa o admin client e seta `pharmacy_id = getCurrentPharmacyId()`.

**Cliente finaliza o pedido:**
1. `components/cart.tsx` chama a server action `criarPedido({ pharmacyId, ... })`.
2. `app/_actions/criar-pedido.ts` grava `orders`/`order_items` com o `pharmacy_id`, reserva estoque e devolve o número do pedido.
3. O carrinho abre o WhatsApp da farmácia com o texto formatado do pedido.
