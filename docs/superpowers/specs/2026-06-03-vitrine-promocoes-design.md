# Vitrine de promoções + promoções no topo do painel — Design

Data: 2026-06-03 · Branch: feat/painel-fase-1

## Objetivo

1. **Site do cliente:** as peças em promoção aparecem numa faixa "Promoções" no
   topo, rodando (auto-rotação) e com setas para deslizar para os lados. As
   mesmas peças continuam aparecendo na grade normal abaixo.
2. **Painel:** os produtos em promoção sobem para o topo da lista de produtos,
   com um selo, para ser fácil achá-los e tirar da promoção depois.

Sem mudança de banco: usa as colunas `on_promo`/`promo_price` já existentes.

## Decisões confirmadas

- Promo aparece **no carrossel do topo E também na grade** normal.
- Cards do carrossel são o **card completo** de produto (deslizando), com
  compra direto dali.
- Auto-rotação + setas de navegação.

## Arquitetura

### 1. `components/promo-carousel.tsx` (novo, client)
- Props: `products: ProductWithVariants[]`, `threshold: number`.
- Recebe já filtrado os produtos em promoção; se vier vazio, retorna `null`.
- Reusa `embla-carousel-react` (mesmo pacote do `product-images.tsx`):
  - `useEmblaCarousel({ loop: true, align: 'start' })`.
  - Auto-rotação por `setInterval(scrollNext, 4000)` quando há ≥ 2 itens.
  - Setas Prev/Next (ChevronLeft/ChevronRight do lucide) chamando
    `scrollPrev`/`scrollNext`; escondidas quando há < 2 itens.
- Cada slide reusa `<ProductCard product threshold index />`; largura do slide
  por flex-basis responsiva (mobile ~78% para o próximo "espiar"; `sm` ~50%;
  `lg` ~33%; `xl` ~25%).
- Título da seção: "🔥 Promoções" (ícone Flame).

### 2. `app/_components/catalog.tsx`
- Deriva `promoProducts = products.filter((p) => p.onPromo && p.promoPrice > 0)`.
- Renderiza `<PromoCarousel products={promoProducts} threshold={threshold} />`
  logo após o `<Hero />` e antes da seção sticky de busca/filtros.
- O carrossel mostra **todas** as promoções, independente de categoria/busca
  (é uma vitrine fixa de destaque).

### 3. Painel — `app/painel/produtos/page.tsx`
- Helper `sortPromoFirst(produtos)` em `lib/data/products.helpers.ts`: retorna
  nova lista com os produtos em promoção (`onPromo && promoPrice > 0`) primeiro,
  preservando a ordem original dentro de cada grupo (sort estável).
- A página ordena com esse helper antes de renderizar (tabela desktop e cards
  mobile).
- Selo vermelho "🔥 Promoção" ao lado do nome quando o produto está em promoção,
  nas duas visões.
- Não altera `getAdminProducts` (evita afetar outros consumidores).

## Testes
- `sortPromoFirst`: promo sobem para o topo; ordem estável dentro dos grupos;
  lista sem promo fica inalterada. Em `lib/data/products.helpers.test.ts`.
- Carrossel e selos: verificação visual (sem teste unitário, igual ao
  `product-images.tsx`).

## Verificação
- `npm test` (vitest) verde.
- `tsc --noEmit` / `next build` sem erros.
- Conferência visual: faixa rodando com setas no topo; promoções no topo do
  painel com selo.

## Deploy
Só código, sem SQL novo. Merge na `main` dispara o deploy automático.
