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
| Testes | Vitest + Testing Library (jsdom) — **102 testes verdes** |
| PDF (comprovantes) | jsPDF (`lib/receipts/pdf-a4.ts`, `lib/receipts/pdf-58mm.ts`) |
| PWA | manifest dinâmico por rota + service worker (`public/sw.js`) |
| Cobrança (opcional) | **ASAAS** via REST (`lib/asaas/`), ativada por variável de ambiente |
| CEP | ViaCEP (fetch direto no client, sem chave) |

## Multi-tenancy (o conceito central)

Uma única aplicação e um único banco atendem várias farmácias. Cada **farmácia é um tenant**, representado por uma linha na tabela `pharmacies`. Toda tabela de negócio (produtos, pedidos, categorias, clientes, etc.) carrega uma coluna **`pharmacy_id`** e é protegida por **RLS** (Row Level Security): o Postgres só devolve/aceita linhas da farmácia do usuário logado. Detalhes em [02 · Banco de dados](./02-BANCO-DE-DADOS.md).

**Como cada requisição sabe "de qual farmácia" é:**
- **Catálogo público** (`/f/[slug]`): pelo **slug na URL** → resolve a farmácia por `getPharmacyBySlug()`.
- **Painel e Gestão**: pelo **usuário logado** → o `profiles` liga o usuário à farmácia e ao papel.
- **Auto-cadastro** (`/cadastro`): cria a farmácia (`provisionPharmacy`) e loga automaticamente.

## Duas formas de acessar o banco

| Cliente | Arquivo | Quando usar | RLS |
|---|---|---|---|
| **Autenticado (anon key + cookies)** | `lib/supabase/server.ts` (`createClient`) | leituras do painel e do catálogo público | **respeita RLS** — isola por tenant automaticamente |
| **Admin (service-role)** | `lib/supabase/admin.ts` (`createAdminClient`) | escritas que precisam setar `pharmacy_id`, criação de usuários, operações de plataforma, checkout anônimo (busca/gravação de cliente) | **ignora RLS** — por isso o código filtra `pharmacy_id` na mão |
| **Browser** | `lib/supabase/client.ts` (`createClient`) | client components (raro) | respeita RLS |

> Regra de ouro: leitura de painel → **client autenticado** (RLS isola sozinho). Escrita → **admin client** setando `pharmacy_id = getCurrentPharmacyId()`.

## Estrutura de pastas

```
app/
  page.tsx                 landing institucional do LeadFarma
  layout.tsx               metadata + tema (html lang pt-BR) + <PwaRegister />
  globals.css               tema Tailwind v4 (paleta laranja LeadFarma)
  f/[slug]/
    page.tsx                CATÁLOGO PÚBLICO por farmácia (anon)
    manifest.webmanifest/route.ts   manifest PWA dinâmico da farmácia (Fase 4)
  cadastro/                 AUTO-CADASTRO público de farmácia (Fase 5, 14 dias grátis)
    page.tsx  actions.ts (autoCadastro)  _components/cadastro-form.tsx
  gestao/                  GESTÃO LeadFarma (superadmin)
    layout.tsx             guard requireSuperadmin
    page.tsx               lista de farmácias
    actions.ts              criarFarmacia / alternarStatus
    _components/           nova-farmacia-form, status-toggle
  painel/                  PAINEL DA FARMÁCIA (pharmacy_admin)
    page.tsx               home do painel
    login/                 login + logout (Supabase Auth)
    cadastro/               onboarding obrigatório da farmácia
    produtos/                CRUD de produto de farmácia (Fase 1: marca, receita, apresentação/dosagem)
    categorias/ envio/ pagamento/  CRUDs
    pedidos/                 pedidos recebidos + comprovantes (Fase 3)
    clientes/                registro de clientes + histórico versionado (Fase 2)
    assinatura/               plano/status + assinar (Fase 5, ASAAS)
    relatorios/               analytics de vendas (Fase 6)
    manifest.webmanifest/route.ts   manifest PWA do painel (Fase 4)
    settings-actions.ts     grava config da farmácia (pharmacies)
  api/asaas/webhook/route.ts   webhook de cobrança ASAAS (Fase 5)
  _actions/                criar-pedido, reserva-carrinho, buscar-cliente (checkout público)
  _components/catalog.tsx  UI do catálogo (client)
components/
  header, hero, cart, product-card, checkout-cliente (Fase 2), pwa-register (Fase 4), ui/ (shadcn)
lib/
  auth/                    session.ts (papel), guards.ts (guards por papel)
  data/                    camada de dados: pharmacy, pharmacy-provisioning (Fase 5),
                           products, categories, shipping, payment, settings, customers (Fase 2),
                           analytics + analytics.helpers (Fase 6), mappers, orders, *.helpers
  receipts/                 receipt.ts (dados+texto) + pdf-a4.ts + pdf-58mm.ts (Fase 3)
  asaas/                    client.ts (fetch + flag) + plans.ts + billing.ts (Fase 5)
  supabase/                server, admin, client
  cpf.ts                     validação/formatação de CPF (Fase 2)
middleware.ts              roteamento por papel + gate de onboarding
supabase/migrations/       schema versionado (0001–0005; Karolla em _karolla_archive)
scripts/
  seed-fase0.mjs             aplica schema base + cria superadmin/farmácia de teste
  apply-migration.mjs        aplica migration(ões) avulsa(s) via Management API (reutilizável)
  seed-produtos-demo.mjs      popula produtos de farmácia de demonstração
  seed-pedidos-demo.mjs       popula pedidos demo (cliente + LGPD + concluídos)
  gen-icons.mjs               gera public/icon-192.png e icon-512.png (cor da marca)
public/
  sw.js                     service worker do PWA (cache leve de estáticos)
  icon-192.png icon-512.png  ícones do PWA (gerados por gen-icons.mjs)
docs/                      esta documentação; specs/planos em docs/superpowers/
```

## Fluxo de uma requisição (exemplos)

**Cliente abre o catálogo `/f/farmacia-teste`:**
1. `app/f/[slug]/page.tsx` recebe o slug.
2. `getPharmacyBySlug(slug)` resolve a farmácia (404 se não existir/estiver suspensa).
3. `getPublicProducts(pharmacy.id)` + envio/pagamento públicos lêem as **views** `public_*` filtrando por `pharmacy_id` (a view `public_products` já expõe `brand`/`requires_prescription`, Fase 1).
4. Renderiza `<Catalog>` com a **marca da farmácia** (logo/nome), metadata de manifest PWA e o rodapé "powered by LeadFarma".

**Farmácia acessa `/painel/produtos`:**
1. `middleware.ts` confere o papel (`pharmacy_admin`) e o gate de onboarding.
2. A página chama `requirePharmacyAdmin()` e lê produtos pelo **client autenticado** → RLS devolve só os da farmácia.
3. Uma edição chama uma **server action** que usa o admin client e seta `pharmacy_id = getCurrentPharmacyId()`.

**Cliente finaliza o pedido (checkout com CPF/endereço/LGPD, Fase 2):**
1. `components/checkout-cliente.tsx` coleta nome/CPF/celular/endereço; ao sair do campo CPF, chama a action anônima `buscarClientePorCpf` (autofill se já houver cadastro na farmácia); ao sair do CEP, consulta o ViaCEP.
2. `components/cart.tsx` chama a server action `criarPedido({ pharmacyId, cliente, ... })`.
3. `app/_actions/criar-pedido.ts` grava `orders`/`order_items` com o `pharmacy_id` e o **snapshot** do cliente (CPF/endereço) sempre; se houve **consentimento LGPD**, chama a RPC `upsert_customer` (grava/atualiza `customers`, versiona o cadastro antigo em `customer_history`) e `increment_customer_orders`; reserva estoque; devolve o número do pedido.
4. O carrinho abre o WhatsApp da farmácia com o texto formatado do pedido.

**Farmácia emite comprovante de um pedido (Fase 3):**
1. Em `/painel/pedidos/[id]`, `ComprovanteActions` monta `ReceiptData` via `buildReceiptData(order, pharmacy)` (`lib/receipts/receipt.ts`), juntando os dados cadastrais da farmácia e o snapshot do cliente do pedido.
2. Botão "Comprovante A4" faz `import()` dinâmico de `pdf-a4.ts` (jsPDF, evita pesar a página) e baixa o PDF; "Cupom 58mm" gera o layout térmico; "Texto" copia `buildReceiptText(data)` para a área de transferência.

**Farmácia se auto-cadastra (Fase 5):**
1. `/cadastro` → `app/cadastro/actions.ts` (`autoCadastro`) valida os dados (Zod), gera um slug único e chama `provisionPharmacy` (`lib/data/pharmacy-provisioning.ts`), compartilhada com a Gestão: cria a farmácia (`plan='trial'`, `subscription_status='trialing'`, `trial_ends_at` em 14 dias), o usuário no Supabase Auth e o `profiles`.
2. A action loga o usuário automaticamente (`signInWithPassword`) e redireciona para `/painel/cadastro` (onboarding obrigatório).
3. Se a farmácia assinar um plano pago em `/painel/assinatura`, a action `assinarPlano` chama `subscribePharmacy` (`lib/asaas/billing.ts`), que só age se `ASAAS_API_KEY` estiver setada; o webhook `app/api/asaas/webhook/route.ts` atualiza `subscription_status` a partir dos eventos do ASAAS.

**Farmácia consulta relatórios (Fase 6):**
1. `/painel/relatorios` chama `getAnalytics()` (`lib/data/analytics.ts`), que busca (RLS) os pedidos + itens dos últimos 12 meses e a categoria atual de cada produto.
2. `computeAnalytics()` (`lib/data/analytics.helpers.ts`, função pura e testada) calcula faturamento/ticket médio (só pedidos `completed`), mais vendidos, por categoria, por mês, por dia da semana e por horário.
