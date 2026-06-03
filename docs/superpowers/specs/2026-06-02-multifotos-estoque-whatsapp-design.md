# Múltiplas fotos, trava de estoque e renomear botão do carrinho

Data: 2026-06-02
Branch: feat/painel-fase-1

## Contexto

Três ajustes pedidos pela dona da loja:

1. Permitir mais de uma foto por produto, com as fotos rodando (carrossel) na vitrine.
2. O link da cliente deixa colocar no carrinho mais peças do que existe em estoque — precisa respeitar o estoque.
3. No carrinho, o botão "Gerar pedido (PDF)" deve se chamar "Enviar pelo WhatsApp" (só o nome; comportamento idêntico).

## Decisões (confirmadas com a usuária)

- Estoque: **travar e mostrar "restam X"** quando estiver acabando.
- Carrossel: **roda sozinho + permite arrastar**.
- Máximo de fotos por produto: **5**.
- Botão: **apenas renomear** (sem juntar passos).

---

## Feature 1 — Múltiplas fotos por produto

### Banco (migration nova `0012_multifotos_estoque.sql`)

- `alter table public.products add column image_urls text[] not null default '{}';`
- A primeira foto da lista também é gravada em `image_url` (capa) — mantém carrinho, PDF e
  painel de pedidos funcionando sem alteração.
- Recriar a view `public.public_products` (security_invoker = false) acrescentando `image_urls`
  ao final das colunas já existentes (id, code, name, category, description, image_url,
  price_wholesale, price_retail, min_wholesale, sort_order, counts_for_wholesale, weight_grams).

### Tipos / mapeamento

- `lib/data/types.ts`: `Product` ganha `imageUrls: string[]`.
- `lib/data/mappers.ts`: `mapProductRow` mapeia `image_urls` → `imageUrls` (default `[]`).
  Se `image_urls` vier vazio mas `image_url` existir, retorna `[image_url]` (compatibilidade
  com produtos antigos).

### Painel (cadastro/edição de produto)

- `produto-schema.ts`: adiciona `imageUrls: z.array(z.string()).max(5).default([])`.
  Mantém `imageUrl` como capa derivada (primeira da lista).
- `produto-form.tsx`: campo "Foto" vira "Fotos (até 5)". Sobe várias (reaproveita
  `uploadProdutoImage` + `compressImage`), mostra miniaturas em grade, botão de remover por foto,
  a 1ª é a capa. Bloqueia upload ao atingir 5.
- `actions.ts` (`createProduto`/`updateProduto`): grava `image_urls = imageUrls` e
  `image_url = imageUrls[0] ?? null`.

### Vitrine (`product-card.tsx`)

- Usa `embla-carousel-react` (já instalado) quando houver 2+ fotos:
  - Auto-rotação a cada ~3500ms via `useEffect` chamando `emblaApi.scrollNext()`.
  - Arrastar/deslizar (comportamento padrão do embla).
  - Bolinhas (dots) indicando a foto atual; clique no dot navega.
- Com 1 foto (ou nenhuma → placeholder), renderiza igual a hoje, sem carrossel.

---

## Feature 2 — Respeitar o estoque

### Problema atual

- A view `public_product_variants` expõe só `available = (stock > 0)`; o cliente não conhece a
  quantidade. Em `getPublicProducts`, o estoque é convertido para binário (`available ? 1 : 0`).
- `criarPedido` **não** valida estoque na hora de fechar o pedido.

### Banco (mesma migration `0012`)

- Recriar `public.public_product_variants` expondo o estoque real:
  `select id, product_id, size, color, stock, (stock > 0) as available from public.product_variants;`

### Leitura pública

- `lib/data/products.ts` (`getPublicProducts`): mapear o estoque real
  (`mapVariantRow({ ...v, stock: v.stock })`) em vez do binário.

### Helper

- `lib/data/products.helpers.ts`: novo `stockOf(product, size, color): number`
  (0 quando a variação não existe). `isVariantAvailable` passa a reusar `stockOf(...) > 0`.

### Card do produto (`product-card.tsx`)

- Calcula `stock = stockOf(product, selectedSize, selectedColor)`.
- O seletor de quantidade não passa de `stock` (botão **+** desabilita no limite; clamp ao trocar
  de tamanho/cor).
- Mostra "só restam X" quando `0 < stock <= 5`.
- Ao adicionar, passa o estoque da variação no item do carrinho (ver abaixo).

### Carrinho (`store.ts` + `cart.tsx`)

- `CartItem` ganha `maxStock: number` (preenchido no `addItem` a partir do card).
  Campo opcional para compatibilidade com carrinhos já persistidos no localStorage.
- `addItem`: ao somar com item existente, limita a soma a `maxStock`.
- `cart.tsx`: botão **+** do item desabilita ao atingir `maxStock`; `updateQuantity` faz clamp.

### Servidor (trava de verdade) — `app/_actions/criar-pedido.ts`

- Antes de inserir o pedido, para cada item conferir `quantity <= stock` da variação
  correspondente. Se exceder (ou variação inexistente), lançar erro amigável
  (ex.: "Estoque insuficiente para <produto> (<tam>/<cor>)"). O carrinho já mostra `aviso` em
  caso de falha de `criarPedido`.

---

## Feature 3 — Renomear botão do carrinho

- `components/cart.tsx`: o botão "Gerar pedido (PDF)" (que dispara `handleGenerate`) passa a
  exibir "Enviar pelo WhatsApp" com ícone `Send`. Comportamento idêntico: gera o PDF e segue para
  a tela de compartilhar, onde o botão verde já existente realmente envia.

---

## Testes (vitest)

- `products.helpers.test.ts`: `stockOf` e `isVariantAvailable` (existe/não existe, estoque 0).
- `order.helpers.test.ts` ou teste do action: validação de estoque insuficiente no fechamento.
- Mapeamento de `imageUrls` em `mappers.test.ts` (lista, fallback de `image_url`, vazio).

## Deploy / migrations

- Criar `supabase/migrations/0012_multifotos_estoque.sql`.
- Acrescentar o mesmo SQL ao final de `docs/APLICAR-NO-SUPABASE.sql`.
- **Rodar o SQL no painel do Supabase ANTES de mergear na main** (deploy automático).

## Fora de escopo (YAGNI)

- Reordenar fotos por arrastar no painel (só remover/recolocar nesta fase).
- Reserva temporária de estoque / decremento de estoque ao fechar pedido (continua manual).
- Mostrar contagem exata de estoque fora da faixa "acabando" (≤5).
