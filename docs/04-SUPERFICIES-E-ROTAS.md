# 04 · Superfícies e rotas

## Mapa de rotas

| Rota | Superfície | Acesso | Arquivo |
|---|---|---|---|
| `/` | Landing LeadFarma | público | `app/page.tsx` |
| `/cadastro` | **Auto-cadastro** de farmácia (14 dias grátis) | público | `app/cadastro/page.tsx` |
| `/f/[slug]` | **Catálogo público** da farmácia | anônimo | `app/f/[slug]/page.tsx` |
| `/f/[slug]/manifest.webmanifest` | Manifest PWA do catálogo (white-label) | anônimo | `app/f/[slug]/manifest.webmanifest/route.ts` |
| `/painel/login` | Login do painel | público | `app/painel/login/page.tsx` |
| `/painel` | Home do painel da farmácia | `pharmacy_admin` | `app/painel/page.tsx` |
| `/painel/manifest.webmanifest` | Manifest PWA do painel (marca da farmácia logada) | `pharmacy_admin` | `app/painel/manifest.webmanifest/route.ts` |
| `/painel/cadastro` | Onboarding / dados da farmácia | `pharmacy_admin` | `app/painel/cadastro/page.tsx` |
| `/painel/produtos` (+ `/novo`, `/[id]`) | CRUD de produto de farmácia | `pharmacy_admin` | `app/painel/produtos/` |
| `/painel/categorias` | Categorias | `pharmacy_admin` | `app/painel/categorias/` |
| `/painel/envio` | Formas de envio | `pharmacy_admin` | `app/painel/envio/` |
| `/painel/pagamento` | Formas de pagamento | `pharmacy_admin` | `app/painel/pagamento/` |
| `/painel/pedidos` (+ `/[id]`) | Pedidos recebidos + comprovantes | `pharmacy_admin` | `app/painel/pedidos/` |
| `/painel/clientes` (+ `/[id]`) | Registro de clientes + histórico | `pharmacy_admin` | `app/painel/clientes/` |
| `/painel/assinatura` | Plano / status / assinar | `pharmacy_admin` | `app/painel/assinatura/` |
| `/painel/relatorios` | Analytics de vendas | `pharmacy_admin` | `app/painel/relatorios/` |
| `/api/asaas/webhook` | Webhook de cobrança ASAAS | público (validado por token) | `app/api/asaas/webhook/route.ts` |
| `/gestao` | **Gestão LeadFarma** (farmácias) | `superadmin` | `app/gestao/page.tsx` |

## 1. Catálogo público — `/f/[slug]`

Resolve a farmácia pelo slug (`getPharmacyBySlug`; **404** se não existir ou estiver suspensa) e renderiza `app/_components/catalog.tsx` com:
- marca da farmácia (`logo_url` + `nome_exibicao`) no `Header`/`Hero`;
- produtos (`getPublicProducts(pharmacyId)`) com **marca/laboratório**, selo **"Exige receita"**, **Apresentação**/**Dosagem**, **preço unitário** e **preço por quantidade** (Fase 1), busca e filtro por categoria;
- **checkout com dados do cliente** (`components/checkout-cliente.tsx`, Fase 2): nome, celular, CPF (validado, com autofill se já houver cadastro na farmácia), endereço (com autofill por CEP via ViaCEP) e **consentimento LGPD** obrigatório para salvar o cadastro;
- carrinho (`components/cart.tsx`) que monta o pedido, grava via `criarPedido` (com o snapshot do cliente) e abre o **WhatsApp** da farmácia;
- **instalável como PWA** (Fase 4): manifest dinâmico (`/f/[slug]/manifest.webmanifest`) com nome/logo/URL da farmácia, service worker registrado por `<PwaRegister />`;
- rodapé **"powered by LeadFarma"**.

## 2. Painel da farmácia — `/painel`

Home lista os CRUDs, o ajuste de "peças para atacado" (preço por quantidade), nome/WhatsApp da loja e banner. Cada página:
- é protegida por `requirePharmacyAdmin()`;
- **lê** com o client autenticado (RLS isola por tenant);
- **escreve** por server actions que setam `pharmacy_id = getCurrentPharmacyId()` (ex.: `app/painel/produtos/actions.ts`, `settings-actions.ts`).

As ações de pedido (`/painel/pedidos`) conferem a **posse** do pedido pela farmácia antes de chamar as RPCs `complete_order`/`cancel_order`.

### `/painel/produtos` — produto de farmácia (Fase 1)
Formulário (`_components/produto-form.tsx`) com: fotos (até 5, capa = primeira), código de barras/EAN, nome, **Marca/Laboratório**, categoria, descrição, **Preço unitário** e **Preço por quantidade**, peso, promoção, selo **"Exige receita médica"**, "conta para o preço por quantidade", ativo/inativo, e a lista de **Apresentações** (apresentação + dosagem + estoque, um por linha).

### `/painel/pedidos/[id]` — detalhe do pedido + comprovantes (Fase 3)
Mostra cliente (nome, CPF formatado, telefone com link do WhatsApp, endereço de entrega), itens (com rótulos "Apres." e "Dosagem"), totais e — em `ComprovanteActions` (`_components/comprovante-actions.tsx`) — três ações: **Comprovante A4** (PDF, `lib/receipts/pdf-a4.ts`, import dinâmico para não pesar a página), **Cupom 58mm** (PDF térmico, `lib/receipts/pdf-58mm.ts`) e **Texto** (copia para a área de transferência via `buildReceiptText`).

### `/painel/clientes` e `/painel/clientes/[id]` (Fase 2)
Lista de clientes cadastrados (nome, CPF, celular, cidade/UF, nº de pedidos) — só aparecem clientes que autorizaram salvar o cadastro (LGPD). O detalhe mostra o **cadastro atual** e o **histórico de versões anteriores** (`customer_history`), com data de cada alteração.

### `/painel/assinatura` (Fase 5)
Mostra o plano atual (`planLabel`), o status da assinatura (`subscriptionLabel`) e, se em `trial`, quantos dias faltam (`trial_ends_at`). Botões de plano (`_components/plano-actions.tsx`) chamam a action `assinarPlano`, que aciona `subscribePharmacy` (`lib/asaas/billing.ts`). Se `ASAAS_API_KEY` não estiver configurada, mostra aviso de que a cobrança online "será ativada em breve" — nada quebra.

### `/painel/relatorios` (Fase 6)
Cards de **faturamento**, **ticket médio**, **pedidos** (com cancelados) e **itens vendidos**; seções de **mais vendidos**, **por categoria**, **por mês**, **por dia da semana** e **por horário**, com barras simples em CSS (`_components/bar-list.tsx`). Dados dos últimos 12 meses, calculados por `getAnalytics()`.

## 3. Gestão LeadFarma — `/gestao`

Protegida por `requireSuperadmin()` (no `layout.tsx`). Contém:
- **lista de farmácias** (nome, slug/URL do catálogo, cadastro completo?, status);
- **"Nova farmácia"** (`_components/nova-farmacia-form.tsx`): cria farmácia + login de uma vez (via `provisionPharmacy`), com slug gerado automaticamente (editável);
- **suspender/reativar** farmácia (`status-toggle.tsx` → action `alternarStatus`).

Actions em `app/gestao/actions.ts`: `criarFarmacia`, `alternarStatus` (ambas exigem super-admin e usam `service_role`).

## 4. Auto-cadastro público — `/cadastro` (Fase 5)

Página de venda + formulário (`_components/cadastro-form.tsx`): nome da farmácia, e-mail, senha, WhatsApp (opcional); mostra os planos (`PLANS`, `lib/asaas/plans.ts`) e destaca os 14 dias grátis. A action `autoCadastro` (`app/cadastro/actions.ts`) gera um slug único, provisiona a farmácia em modo `trial`, loga o usuário e manda para `/painel/cadastro` (onboarding).

## 5. Webhook de cobrança — `/api/asaas/webhook` (Fase 5)

`POST` recebido do ASAAS. Valida o header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN` (se configurado) e atualiza `subscription_status` da farmácia (`active`/`past_due`/`canceled`) a partir do tipo de evento (`PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, etc.), buscando por `asaas_subscription_id` ou `asaas_customer_id`. Sempre responde `200` (contrato do ASAAS, para não reenviar).

## Identidade visual

- Paleta **LeadFarma**: base branca, **laranja `#F97316`** como cor de ação/destaque, apoio em tons de saúde (azul/verde). Definida em `app/globals.css` (Tailwind v4) — substituiu o tema fitness escuro + verde-limão.
- **Marca dupla:** o cliente vê a **farmácia** (logo/nome vindos de `pharmacies`, inclusive no manifest PWA); a **LeadFarma** aparece no título do app, no painel de gestão, na página `/cadastro` e no "powered by LeadFarma" do rodapé.
- Componentes de marca aceitam props dinâmicas: `Header`, `Hero` e `Cart` recebem `storeName`/`logoUrl` da farmácia.
- **PWA (Fase 4):** catálogo e painel são instaláveis; ícones padrão (`public/icon-192.png`/`icon-512.png`, cor da marca) usados quando a farmácia não tem logo própria.
