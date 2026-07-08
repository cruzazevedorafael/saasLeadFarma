# 04 · Superfícies e rotas

## Mapa de rotas

| Rota | Superfície | Acesso | Arquivo |
|---|---|---|---|
| `/` | Landing LeadFarma | público | `app/page.tsx` |
| `/f/[slug]` | **Catálogo público** da farmácia | anônimo | `app/f/[slug]/page.tsx` |
| `/painel/login` | Login do painel | público | `app/painel/login/page.tsx` |
| `/painel` | Home do painel da farmácia | `pharmacy_admin` | `app/painel/page.tsx` |
| `/painel/cadastro` | Onboarding / dados da farmácia | `pharmacy_admin` | `app/painel/cadastro/page.tsx` |
| `/painel/produtos` (+ `/novo`, `/[id]`) | CRUD de produtos | `pharmacy_admin` | `app/painel/produtos/` |
| `/painel/categorias` | Categorias | `pharmacy_admin` | `app/painel/categorias/` |
| `/painel/envio` | Formas de envio | `pharmacy_admin` | `app/painel/envio/` |
| `/painel/pagamento` | Formas de pagamento | `pharmacy_admin` | `app/painel/pagamento/` |
| `/painel/pedidos` (+ `/[id]`) | Pedidos recebidos | `pharmacy_admin` | `app/painel/pedidos/` |
| `/gestao` | **Gestão LeadFarma** (farmácias) | `superadmin` | `app/gestao/page.tsx` |

## 1. Catálogo público — `/f/[slug]`

Resolve a farmácia pelo slug (`getPharmacyBySlug`; **404** se não existir ou estiver suspensa) e renderiza `app/_components/catalog.tsx` com:
- marca da farmácia (`logo_url` + `nome_exibicao`) no `Header`/`Hero`;
- produtos (`getPublicProducts(pharmacyId)`), busca e filtro por categoria;
- carrinho (`components/cart.tsx`) que monta o pedido, grava via `criarPedido` e abre o **WhatsApp** da farmácia;
- rodapé **"powered by LeadFarma"**.

## 2. Painel da farmácia — `/painel`

Home lista os CRUDs, o ajuste de "peças para atacado", nome/WhatsApp da loja e banner. Cada página:
- é protegida por `requirePharmacyAdmin()`;
- **lê** com o client autenticado (RLS isola por tenant);
- **escreve** por server actions que setam `pharmacy_id = getCurrentPharmacyId()` (ex.: `app/painel/produtos/actions.ts`, `settings-actions.ts`).

As ações de pedido (`/painel/pedidos`) conferem a **posse** do pedido pela farmácia antes de chamar as RPCs `complete_order`/`cancel_order`.

## 3. Gestão LeadFarma — `/gestao`

Protegida por `requireSuperadmin()` (no `layout.tsx`). Contém:
- **lista de farmácias** (nome, slug/URL do catálogo, cadastro completo?, status);
- **"Nova farmácia"** (`_components/nova-farmacia-form.tsx`): cria farmácia + login de uma vez, com slug gerado automaticamente (editável);
- **suspender/reativar** farmácia (`status-toggle.tsx` → action `alternarStatus`).

Actions em `app/gestao/actions.ts`: `criarFarmacia`, `alternarStatus` (ambas exigem super-admin e usam `service_role`).

## Identidade visual

- Paleta **LeadFarma**: base branca, **laranja `#F97316`** como cor de ação/destaque, apoio em tons de saúde (azul/verde). Definida em `app/globals.css` (Tailwind v4) — substituiu o tema fitness escuro + verde-limão.
- **Marca dupla:** o cliente vê a **farmácia** (logo/nome vindos de `pharmacies`); a **LeadFarma** aparece no título do app, no painel de gestão e no "powered by LeadFarma" do rodapé.
- Componentes de marca aceitam props dinâmicas: `Header`, `Hero` e `Cart` recebem `storeName`/`logoUrl` da farmácia.
