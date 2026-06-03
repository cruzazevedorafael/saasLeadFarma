# Promoção de produtos + ajustes no catálogo — Design

Data: 2026-06-03 · Branch: feat/painel-fase-1

## Objetivo

Três frentes pedidas pela dona da loja:

1. **Promoção:** marcar uma peça como "em promoção" no painel, com um preço
   promocional. No catálogo do cliente a peça aparece com **um único preço**
   dentro de um balão de destaque "Promoção", e esse é o preço cobrado.
2. **Descrição cortada:** no catálogo a descrição está limitada a 2 linhas
   (`line-clamp-2`) e corta o texto. Deve caber o texto inteiro.
3. **Seletor de tamanho:** (a) quando só há 1 tamanho ele não fica verde
   (selecionado); deve ficar. (b) o botão é pequeno e corta rótulos maiores;
   deve caber o texto todo.

## Decisões confirmadas

- A promoção usa um **preço promocional novo** (campo separado), não o varejo.
- O cliente vê **só um preço** no balão (sem preço antigo riscado).
- A peça em promoção **continua contando** para virar atacado; apenas o preço
  unitário dela passa a ser fixo no promocional, ignorando varejo/atacado.

## Arquitetura

O ponto-chave: todo cálculo de preço (carrinho, resumo do checkout, pedido
salvo no painel e PDF) passa por `unitPriceFor()` em `lib/data/cart.helpers.ts`.
Tornando essa função "promo-aware", o preço promocional flui por toda a cadeia
sem tocar em cada chamador.

### 1. Banco — migration `0013_promocao.sql`
- `products`: `add column if not exists on_promo boolean not null default false`
  e `add column if not exists promo_price numeric`.
- `create or replace view public.public_products`: repete as colunas atuais na
  mesma ordem e **acrescenta `on_promo, promo_price` no fim** do `select`
  (exigência do `create or replace view`).
- `grant select` para `anon` permanece.

### 2. Tipos + mapper (`lib/data/types.ts`, `lib/data/mappers.ts`)
- `Product` ganha `onPromo: boolean` e `promoPrice: number`.
- `mapProductRow`: `onPromo: r.on_promo ?? false`,
  `promoPrice: Number(r.promo_price ?? 0)`.
- Teste em `mappers.test.ts` cobrindo leitura e defaults.

### 3. Preço promo-aware (`lib/data/cart.helpers.ts`)
- `unitPriceFor(product, priceType)`: se `product.onPromo && product.promoPrice > 0`,
  retorna `promoPrice`; senão mantém varejo/atacado.
- Amplia o tipo do parâmetro para incluir `onPromo?`/`promoPrice?`.
- Teste em `cart.helpers.test.ts`: peça em promoção mantém o promocional em
  carrinho varejo e atacado; sem promoção, comportamento atual.

### 4. Painel — edição (`produto-schema.ts`, `produto-form.tsx`, `actions.ts`)
- Schema: `onPromo: z.boolean().default(false)`,
  `promoPrice: z.number().min(0).default(0)`, com `.refine` exigindo
  `promoPrice > 0` quando `onPromo` é true.
- Form: `Switch` "Em promoção"; quando ligado, mostra campo
  "Preço promocional (R$)".
- Actions (`createProduto`/`updateProduto`): grava `on_promo` e `promo_price`.
- Teste em `produto-schema.test.ts` para a regra do refine.

### 5. Catálogo — balão de promoção (`components/product-card.tsx`)
- Quando `product.onPromo && product.promoPrice > 0`: no lugar da linha de dois
  preços (Varejo/Atacado), renderiza um balão de destaque (cor chamativa, ex.
  vermelho/âmbar) com ícone e "Promoção" + o preço promocional único.
- Caso contrário, mantém a linha atual de dois preços.

### 6. Descrição completa (`components/product-card.tsx`)
- Remove `line-clamp-2` do `<p>` da descrição. Cards podem variar de altura.

### 7. Seletor de tamanho (`components/product-card.tsx`)
- Bloco de tamanho renderiza **botão sempre que houver ≥ 1 tamanho** (não usa
  mais `shouldRenderAsButtons` para tamanho; cores seguem como hoje). Com 1
  tamanho, ele já vem selecionado → fica verde.
- Botão: troca largura fixa (`w-8/w-10`) por `min-w` + padding lateral, para
  caber rótulos maiores (GG, EXG, "38/40", "Único").

## Verificação
- `pnpm`/`npm test` (vitest) verde.
- `tsc --noEmit` / `next build` sem erros de tipo.
- Conferência visual do balão e do seletor no catálogo.

## Deploy
Aplicar `0013_promocao.sql` no painel do Supabase **antes** do merge na main
(deploy automático). Ver [[migrations-antes-do-merge]].
