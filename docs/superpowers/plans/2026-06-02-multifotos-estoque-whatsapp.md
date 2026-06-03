# Múltiplas fotos, trava de estoque e renomear botão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir até 5 fotos por produto (carrossel auto-rotativo na vitrine), travar a quantidade do carrinho pelo estoque real (cliente e servidor), e renomear o botão "Gerar pedido (PDF)" para "Enviar pelo WhatsApp".

**Architecture:** Banco ganha `products.image_urls text[]` e as views públicas passam a expor `image_urls` e o `stock` real. A camada de dados mapeia esses campos; a vitrine usa `embla-carousel-react` (já instalado) para o carrossel; carrinho e card limitam a quantidade pelo estoque; `criarPedido` valida estoque no servidor como trava final.

**Tech Stack:** Next.js (App Router) + Supabase + Zustand + react-hook-form/zod + embla-carousel-react + vitest.

**Spec:** `docs/superpowers/specs/2026-06-02-multifotos-estoque-whatsapp-design.md`

---

## File Structure

- `supabase/migrations/0012_multifotos_estoque.sql` — **criar**: coluna `image_urls`, recriar as duas views públicas.
- `docs/APLICAR-NO-SUPABASE.sql` — **modificar**: acrescentar o SQL da 0012 no fim.
- `lib/data/types.ts` — **modificar**: `Product.imageUrls: string[]`.
- `lib/data/mappers.ts` — **modificar**: mapear `image_urls`.
- `lib/data/mappers.test.ts` — **modificar**: teste de `imageUrls`.
- `lib/data/products.helpers.ts` — **modificar**: `stockOf` + reuso em `isVariantAvailable`.
- `lib/data/products.helpers.test.ts` — **modificar**: testes de `stockOf` + `imageUrls` no fixture.
- `lib/data/products.ts` — **modificar**: `getPublicProducts` usa estoque real.
- `lib/data/order.helpers.ts` — **modificar**: `validateStock`.
- `lib/data/order.helpers.test.ts` — **modificar**: testes de `validateStock` + `imageUrls` no factory.
- `lib/data/cart.helpers.test.ts` — **modificar**: `imageUrls` no factory.
- `app/_actions/criar-pedido.ts` — **modificar**: chamar `validateStock`.
- `app/painel/produtos/_components/produto-schema.ts` — **modificar**: campo `imageUrls`.
- `app/painel/produtos/actions.ts` — **modificar**: gravar `image_urls`.
- `app/painel/produtos/_components/produto-form.tsx` — **modificar**: UI de várias fotos.
- `components/product-images.tsx` — **criar**: carrossel.
- `components/product-card.tsx` — **modificar**: usar carrossel + travar quantidade + "restam X".
- `lib/store.ts` — **modificar**: `CartItem.maxStock`.
- `components/cart.tsx` — **modificar**: travar `+` por estoque + renomear botão.

---

## Task 1: Migration de banco (image_urls + views com estoque real)

**Files:**
- Create: `supabase/migrations/0012_multifotos_estoque.sql`
- Modify: `docs/APLICAR-NO-SUPABASE.sql` (append no fim)

- [ ] **Step 1: Criar a migration**

Criar `supabase/migrations/0012_multifotos_estoque.sql`:

```sql
-- supabase/migrations/0012_multifotos_estoque.sql

-- 1) Várias fotos por produto (a 1ª continua espelhada em image_url = capa)
alter table public.products
  add column image_urls text[] not null default '{}';

-- 2) View pública de produtos: expõe image_urls (append no fim das colunas)
create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams, image_urls
  from public.products
  where active = true;

-- 3) View pública de variações: expõe o estoque real (mantém available por segurança)
create or replace view public.public_product_variants
  with (security_invoker = false) as
  select id, product_id, size, color, stock, (stock > 0) as available
  from public.product_variants;

grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;
```

- [ ] **Step 2: Acrescentar o mesmo SQL ao fim de `docs/APLICAR-NO-SUPABASE.sql`**

Adicionar no final do arquivo:

```sql

-- ---------- 0012: várias fotos + estoque real nas views ----------
alter table public.products
  add column image_urls text[] not null default '{}';

create or replace view public.public_products
  with (security_invoker = false) as
  select id, code, name, category, description, image_url,
         price_wholesale, price_retail, min_wholesale, sort_order,
         counts_for_wholesale, weight_grams, image_urls
  from public.products
  where active = true;

create or replace view public.public_product_variants
  with (security_invoker = false) as
  select id, product_id, size, color, stock, (stock > 0) as available
  from public.product_variants;

grant select on public.public_products to anon;
grant select on public.public_product_variants to anon;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0012_multifotos_estoque.sql docs/APLICAR-NO-SUPABASE.sql
git commit -m "feat(db): coluna image_urls + views públicas com estoque real"
```

> ⚠️ Esta migration precisa ser rodada no painel do Supabase ANTES do merge na main (deploy automático). A verificação de runtime acontece nas tarefas seguintes assumindo o banco já migrado em dev; se o banco de dev ainda não foi migrado, rode o SQL acima no SQL Editor antes de testar as Tasks 4, 6, 7, 8, 9.

---

## Task 2: Tipo e mapeamento de `imageUrls`

**Files:**
- Modify: `lib/data/types.ts`
- Modify: `lib/data/mappers.ts`
- Test: `lib/data/mappers.test.ts`
- Modify (fixtures): `lib/data/products.helpers.test.ts`, `lib/data/order.helpers.test.ts`, `lib/data/cart.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `lib/data/mappers.test.ts`, dentro do `describe('mapProductRow', ...)`, adicionar:

```ts
  it('mapeia image_urls quando presente', () => {
    expect(mapProductRow({ id: '3', code: 'A', name: 'B', image_urls: ['x.jpg', 'y.jpg'] }).imageUrls)
      .toEqual(['x.jpg', 'y.jpg'])
  })

  it('image_urls cai para [image_url] quando lista vazia', () => {
    expect(mapProductRow({ id: '4', code: 'A', name: 'B', image_url: 'capa.jpg', image_urls: [] }).imageUrls)
      .toEqual(['capa.jpg'])
  })

  it('image_urls vira [] quando não há nada', () => {
    expect(mapProductRow({ id: '5', code: 'A', name: 'B' }).imageUrls).toEqual([])
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- mappers`
Expected: FAIL (a propriedade `imageUrls` não existe / é undefined).

- [ ] **Step 3: Adicionar o campo no tipo**

Em `lib/data/types.ts`, na interface `Product`, logo abaixo de `imageUrl: string | null`:

```ts
  imageUrl: string | null
  imageUrls: string[]
```

- [ ] **Step 4: Mapear no `mapProductRow`**

Em `lib/data/mappers.ts`, dentro do objeto retornado por `mapProductRow`, abaixo da linha `imageUrl: r.image_url ?? null,`:

```ts
    imageUrl: r.image_url ?? null,
    imageUrls: Array.isArray(r.image_urls) && r.image_urls.length > 0
      ? (r.image_urls as string[])
      : (r.image_url ? [r.image_url] : []),
```

- [ ] **Step 5: Atualizar os fixtures de tipo para incluir `imageUrls`**

Em `lib/data/order.helpers.test.ts`, na função `prod`, adicionar `imageUrls: []` (ao lado de `imageUrl: null`):

```ts
    id: 'p', code: 'C', name: 'X', category: '', description: '', imageUrl: null, imageUrls: [],
```

Em `lib/data/cart.helpers.test.ts`, na função `product`, mesma adição:

```ts
    id: 'p', code: 'C', name: 'X', category: '', description: '', imageUrl: null, imageUrls: [],
```

Em `lib/data/products.helpers.test.ts`, no literal `const p`, adicionar `imageUrls: []`:

```ts
  imageUrl: null, imageUrls: [], priceCost: 20, priceWholesale: 49.9, priceRetail: 89.9, weightGrams: 250,
```

- [ ] **Step 6: Rodar a suíte inteira e ver passar**

Run: `pnpm test`
Expected: PASS (inclusive os novos testes de `imageUrls`; nenhum erro de tipo nos fixtures).

- [ ] **Step 7: Commit**

```bash
git add lib/data/types.ts lib/data/mappers.ts lib/data/mappers.test.ts lib/data/order.helpers.test.ts lib/data/cart.helpers.test.ts lib/data/products.helpers.test.ts
git commit -m "feat(data): Product.imageUrls com fallback para image_url"
```

---

## Task 3: Helper `stockOf`

**Files:**
- Modify: `lib/data/products.helpers.ts`
- Test: `lib/data/products.helpers.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `lib/data/products.helpers.test.ts`, adicionar no topo o import e um novo bloco (o fixture `p` já tem M/Preto=3, G/Preto=0, M/Rosa=5):

```ts
import { sizesOf, colorsOf, isVariantAvailable, stockOf } from './products.helpers'
```

(substitua a linha de import existente por essa) e adicione:

```ts
describe('stockOf', () => {
  it('retorna o estoque da variação', () => {
    expect(stockOf(p, 'M', 'Preto')).toBe(3)
    expect(stockOf(p, 'M', 'Rosa')).toBe(5)
  })
  it('retorna 0 quando estoque zerado', () => {
    expect(stockOf(p, 'G', 'Preto')).toBe(0)
  })
  it('retorna 0 quando a combinação não existe', () => {
    expect(stockOf(p, 'GG', 'Azul')).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- products.helpers`
Expected: FAIL (`stockOf` não exportado).

- [ ] **Step 3: Implementar `stockOf` e reusar em `isVariantAvailable`**

Em `lib/data/products.helpers.ts`, substituir a função `isVariantAvailable` por:

```ts
export function stockOf(p: ProductWithVariants, size: string, color: string): number {
  const v = p.variants.find((x) => x.size === size && x.color === color)
  return v?.stock ?? 0
}

export function isVariantAvailable(p: ProductWithVariants, size: string, color: string): boolean {
  return stockOf(p, size, color) > 0
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- products.helpers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/data/products.helpers.ts lib/data/products.helpers.test.ts
git commit -m "feat(data): helper stockOf e isVariantAvailable reutilizando-o"
```

---

## Task 4: Leitura pública usa o estoque real

**Files:**
- Modify: `lib/data/products.ts:24-31` (mapeamento em `getPublicProducts`)

- [ ] **Step 1: Trocar o estoque binário pelo real**

Em `lib/data/products.ts`, dentro de `getPublicProducts`, o `.map` final está convertendo `available` em 1/0. Substituir o bloco:

```ts
  return products.map((p) => ({
    ...mapProductRow({ ...p, price_cost: 0, active: true }),
    variants: variants
      .filter((v) => v.product_id === p.id)
      // a view pública expõe `available`; convertendo p/ stock binário (1/0) nesta fase
      .map((v) => mapVariantRow({ ...v, stock: v.available ? 1 : 0 })),
  }))
```

por:

```ts
  return products.map((p) => ({
    ...mapProductRow({ ...p, price_cost: 0, active: true }),
    variants: variants
      .filter((v) => v.product_id === p.id)
      // a view pública agora expõe o estoque real
      .map((v) => mapVariantRow(v)),
  }))
```

- [ ] **Step 2: Verificar build de tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/data/products.ts
git commit -m "feat(data): vitrine pública lê o estoque real das variações"
```

---

## Task 5: Schema e action gravam várias fotos

**Files:**
- Modify: `app/painel/produtos/_components/produto-schema.ts`
- Modify: `app/painel/produtos/actions.ts` (createProduto + updateProduto)

- [ ] **Step 1: Adicionar `imageUrls` ao schema**

Em `app/painel/produtos/_components/produto-schema.ts`, no `produtoSchema`, abaixo de `imageUrl`:

```ts
  imageUrl: z.string().nullable().default(null),
  imageUrls: z.array(z.string()).max(5, 'Máximo de 5 fotos').default([]),
```

- [ ] **Step 2: Gravar `image_urls` no createProduto**

Em `app/painel/produtos/actions.ts`, em `createProduto`, no `.insert({...})` de `products`, trocar o trecho `image_url: data.imageUrl ?? null,` por:

```ts
    counts_for_wholesale: data.countsForWholesale, active: data.active,
    image_url: data.imageUrls[0] ?? data.imageUrl ?? null,
    image_urls: data.imageUrls,
```

(substituindo a linha existente que terminava em `image_url: data.imageUrl ?? null,`)

- [ ] **Step 3: Gravar `image_urls` no updateProduto**

Em `app/painel/produtos/actions.ts`, em `updateProduto`, no `.update({...})` de `products`, trocar `image_url: data.imageUrl ?? null, updated_at: ...` por:

```ts
    counts_for_wholesale: data.countsForWholesale, active: data.active,
    image_url: data.imageUrls[0] ?? data.imageUrl ?? null,
    image_urls: data.imageUrls,
    updated_at: new Date().toISOString(),
```

- [ ] **Step 4: Verificar build de tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/_components/produto-schema.ts app/painel/produtos/actions.ts
git commit -m "feat(painel): produto salva lista de fotos (image_urls) com capa derivada"
```

---

## Task 6: Formulário do painel com várias fotos

**Files:**
- Modify: `app/painel/produtos/_components/produto-form.tsx`

- [ ] **Step 1: Inicializar `imageUrls` no estado do form**

Em `produto-form.tsx`, trocar o estado da foto única por uma lista. Substituir:

```ts
  const [imageUrl, setImageUrlState] = useState<string | null>(produto?.imageUrl ?? null)
```

por:

```ts
  const [imageUrls, setImageUrlsState] = useState<string[]>(
    produto?.imageUrls?.length ? produto.imageUrls : produto?.imageUrl ? [produto.imageUrl] : []
  )
  const MAX_FOTOS = 5
```

- [ ] **Step 2: Incluir `imageUrls` nos defaultValues**

No `useForm`, em ambos os ramos de `defaultValues`, adicionar `imageUrls`:

No ramo `produto ? { ... }`, ao lado de `imageUrl: produto.imageUrl,`:

```ts
          countsForWholesale: produto.countsForWholesale, active: produto.active, imageUrl: produto.imageUrl,
          imageUrls: produto.imageUrls?.length ? produto.imageUrls : produto.imageUrl ? [produto.imageUrl] : [],
```

No ramo `: { ... }` (novo produto), ao lado de `imageUrl: null,`:

```ts
          countsForWholesale: true, active: true, imageUrl: null, imageUrls: [],
```

- [ ] **Step 3: Suportar upload múltiplo e remoção**

Substituir a função `onUpload` por uma versão que aceita vários arquivos e respeita o limite:

```ts
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setSubmitError(null)
    try {
      const livres = MAX_FOTOS - imageUrls.length
      const aSubir = files.slice(0, Math.max(0, livres))
      const novas: string[] = []
      for (const file of aSubir) {
        const compressed = await compressImage(file)
        novas.push(await uploadProdutoImage(compressed))
      }
      const todas = [...imageUrls, ...novas].slice(0, MAX_FOTOS)
      setImageUrlsState(todas)
      setValue('imageUrls', todas)
      setValue('imageUrl', todas[0] ?? null)
    } catch {
      setSubmitError('Falha ao subir a(s) foto(s).')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removerFoto = (url: string) => {
    const todas = imageUrls.filter((u) => u !== url)
    setImageUrlsState(todas)
    setValue('imageUrls', todas)
    setValue('imageUrl', todas[0] ?? null)
  }
```

- [ ] **Step 4: Trocar o bloco de UI da foto**

Substituir o bloco `<div className="space-y-2"> ... Foto ... </div>` (o primeiro, com `<Label>Foto</Label>`) por:

```tsx
      <div className="space-y-2">
        <Label>Fotos (até {MAX_FOTOS}) — a 1ª é a capa</Label>
        {imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-[#CFFF04] px-1 text-[10px] font-medium text-black">capa</span>
                )}
                <button
                  type="button"
                  onClick={() => removerFoto(url)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {imageUrls.length < MAX_FOTOS && (
          <Input type="file" accept="image/*" multiple onChange={onUpload} disabled={uploading} />
        )}
        {uploading && <p className="text-xs text-muted-foreground">Subindo...</p>}
        {imageUrls.length >= MAX_FOTOS && (
          <p className="text-xs text-muted-foreground">Limite de {MAX_FOTOS} fotos atingido.</p>
        )}
      </div>
```

(`Trash2` já está importado no arquivo.)

- [ ] **Step 5: Verificar build de tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Verificação manual**

Run: `pnpm dev`
Abrir `/painel/produtos/novo`, subir 2–3 fotos, ver as miniaturas com "capa" na primeira, remover uma, salvar. Conferir no banco que `image_urls` tem a lista e `image_url` é a primeira.

- [ ] **Step 7: Commit**

```bash
git add app/painel/produtos/_components/produto-form.tsx
git commit -m "feat(painel): upload de até 5 fotos por produto com capa e remoção"
```

---

## Task 7: Carrossel na vitrine + travar quantidade + "restam X"

**Files:**
- Create: `components/product-images.tsx`
- Modify: `components/product-card.tsx`

- [ ] **Step 1: Criar o componente de carrossel**

Criar `components/product-images.tsx`:

```tsx
// components/product-images.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import useEmblaCarousel from 'embla-carousel-react'

export function ProductImages({ images, alt }: { images: string[]; alt: string }) {
  const list = images.length > 0 ? images : ['/placeholder.svg']
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true })
  const [selected, setSelected] = useState(0)

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  useEffect(() => {
    if (!emblaApi || list.length < 2) return
    const id = setInterval(() => emblaApi.scrollNext(), 3500)
    return () => clearInterval(id)
  }, [emblaApi, list.length])

  if (list.length < 2) {
    return (
      <Image
        src={list[0]}
        alt={alt}
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-110"
      />
    )
  }

  return (
    <>
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {list.map((src, i) => (
            <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
              <Image src={src} alt={alt} fill className="object-cover" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
        {list.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Foto ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === selected ? 'w-4 bg-[#CFFF04]' : 'w-1.5 bg-white/60'}`}
          />
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Usar o carrossel no card e importar `stockOf`**

Em `components/product-card.tsx`:

Trocar a linha de import dos helpers:

```ts
import { sizesOf, colorsOf, isVariantAvailable, shouldRenderAsButtons } from '@/lib/data/products.helpers'
```

por:

```ts
import { sizesOf, colorsOf, isVariantAvailable, shouldRenderAsButtons, stockOf } from '@/lib/data/products.helpers'
import { ProductImages } from '@/components/product-images'
```

Remover o import do `Image` do next (não é mais usado diretamente aqui):

```ts
import Image from 'next/image'
```
→ apagar essa linha.

Substituir o `<Image .../>` dentro de `<div className="relative aspect-[4/5] overflow-hidden">` por:

```tsx
        <ProductImages images={product.imageUrls} alt={product.name} />
```

- [ ] **Step 3: Calcular estoque e travar a quantidade**

Em `product-card.tsx`, logo após `const available = isVariantAvailable(product, selectedSize, selectedColor)`:

```ts
  const stock = stockOf(product, selectedSize, selectedColor)
```

Adicionar um `useEffect` para limitar a quantidade quando trocar de variação (logo abaixo dos `useState`):

```ts
  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, stock)))
  }, [stock])
```

E garantir o import de `useEffect`:

```ts
import { useState } from 'react'
```
→

```ts
import { useState, useEffect } from 'react'
```

- [ ] **Step 4: Travar o botão "+" e mostrar "restam X"**

No bloco de Quantidade, trocar o botão de `+` por uma versão travada:

```tsx
            <button onClick={() => setQuantity(quantity + 1)} className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors">
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
```

por:

```tsx
            <button
              onClick={() => setQuantity(Math.min(stock, quantity + 1))}
              disabled={quantity >= stock}
              className="h-7 w-7 md:h-8 md:w-8 rounded-md flex items-center justify-center hover:bg-background transition-colors disabled:opacity-40"
            >
              <Plus className="h-3 w-3 md:h-4 md:w-4" />
            </button>
```

E na linha do label "Quantidade", mostrar o aviso de estoque baixo. Trocar:

```tsx
          <span className="text-[10px] md:text-xs text-muted-foreground">Quantidade</span>
```

por:

```tsx
          <span className="text-[10px] md:text-xs text-muted-foreground">
            Quantidade
            {stock > 0 && stock <= 5 && (
              <span className="ml-1.5 text-amber-400">só restam {stock}</span>
            )}
          </span>
```

- [ ] **Step 5: Passar o estoque ao adicionar no carrinho**

Na função `handleAddToCart`, trocar:

```ts
    addItem({ product, quantity, size: selectedSize, color: selectedColor })
```

por:

```ts
    addItem({ product, quantity, size: selectedSize, color: selectedColor, maxStock: stock })
```

(O campo `maxStock` é adicionado ao tipo na Task 8; se o TS reclamar aqui antes da Task 8, faça as duas em sequência — a Task 8 define o campo.)

- [ ] **Step 6: Verificar build de tipos (após a Task 8 também)**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros depois que a Task 8 estiver feita.

- [ ] **Step 7: Verificação manual**

Run: `pnpm dev`
Num produto com 2+ fotos: as fotos trocam sozinhas e dá pra arrastar; bolinhas funcionam. Num produto com estoque 3 daquela variação: o `+` trava em 3 e aparece "só restam 3".

- [ ] **Step 8: Commit**

```bash
git add components/product-images.tsx components/product-card.tsx
git commit -m "feat(vitrine): carrossel auto-rotativo e trava de quantidade por estoque"
```

---

## Task 8: Carrinho — `maxStock` no store, trava do "+" e renomear botão

**Files:**
- Modify: `lib/store.ts`
- Modify: `components/cart.tsx`

- [ ] **Step 1: Adicionar `maxStock` ao `CartItem` e limitar a soma**

Em `lib/store.ts`, na interface `CartItem`, adicionar o campo opcional:

```ts
export interface CartItem {
  product: Product
  quantity: number
  size: string
  color: string
  maxStock?: number
}
```

No `addItem`, trocar o ramo de item existente para respeitar o teto:

```ts
          if (existingIndex >= 0) {
            const newItems = [...state.items]
            newItems[existingIndex].quantity += item.quantity
            return { items: newItems }
          }
```

por:

```ts
          if (existingIndex >= 0) {
            const newItems = [...state.items]
            const teto = item.maxStock ?? newItems[existingIndex].maxStock ?? Infinity
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: Math.min(teto, newItems[existingIndex].quantity + item.quantity),
              maxStock: item.maxStock ?? newItems[existingIndex].maxStock,
            }
            return { items: newItems }
          }
```

- [ ] **Step 2: Travar o "+" de cada item no carrinho**

Em `components/cart.tsx`, no `CartItemCard`, calcular o teto e aplicar no botão `+`. Logo abaixo de `const price = unitPriceFor(item.product, priceType)`:

```ts
  const max = item.maxStock ?? Infinity
```

Trocar o botão de `+`:

```tsx
            <button onClick={() => onUpdateQuantity(item.quantity + 1)} className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors">
              <Plus className="h-3 w-3" />
            </button>
```

por:

```tsx
            <button
              onClick={() => onUpdateQuantity(Math.min(max, item.quantity + 1))}
              disabled={item.quantity >= max}
              className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
```

- [ ] **Step 3: Renomear o botão "Gerar pedido (PDF)" → "Enviar pelo WhatsApp"**

Em `components/cart.tsx`, no bloco do `showCheckout` (botão que chama `handleGenerate`), trocar o conteúdo do botão:

```tsx
                          ) : (
                            <><FileText className="h-4 w-4 md:h-5 md:w-5 mr-2" /> Gerar pedido (PDF)</>
                          )}
```

por:

```tsx
                          ) : (
                            <><Send className="h-4 w-4 md:h-5 md:w-5 mr-2" /> Enviar pelo WhatsApp</>
                          )}
```

(`Send` já está importado no arquivo.)

- [ ] **Step 4: Verificar build de tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros (resolve também o `maxStock` usado na Task 7).

- [ ] **Step 5: Rodar os testes**

Run: `pnpm test`
Expected: PASS (o `CartItem` opcional não quebra os fixtures de `cart.helpers.test.ts`).

- [ ] **Step 6: Verificação manual**

Run: `pnpm dev`
Adicionar ao carrinho uma variação com estoque 3 com quantidade 3; no carrinho o `+` deve estar travado. No checkout, o botão deve dizer "Enviar pelo WhatsApp" e, ao tocar, gerar o PDF e ir pra tela de compartilhar.

- [ ] **Step 7: Commit**

```bash
git add lib/store.ts components/cart.tsx
git commit -m "feat(carrinho): trava quantidade por estoque e renomeia botão para Enviar pelo WhatsApp"
```

---

## Task 9: Trava de estoque no servidor (fechamento do pedido)

**Files:**
- Modify: `lib/data/order.helpers.ts`
- Test: `lib/data/order.helpers.test.ts`
- Modify: `app/_actions/criar-pedido.ts`

- [ ] **Step 1: Escrever o teste que falha**

Em `lib/data/order.helpers.test.ts`, adicionar o import e um novo `describe` (o fixture `legging` tem M/Preto com stock 5):

```ts
import { buildOrder, validateStock } from './order.helpers'
```

(substitua a linha de import existente por essa) e adicione:

```ts
describe('validateStock', () => {
  it('passa quando a quantidade cabe no estoque', () => {
    expect(() => validateStock([legging], [{ productId: 'L', size: 'M', color: 'Preto', quantity: 5 }])).not.toThrow()
  })
  it('lança quando passa do estoque', () => {
    expect(() => validateStock([legging], [{ productId: 'L', size: 'M', color: 'Preto', quantity: 6 }]))
      .toThrow(/Estoque insuficiente/)
  })
  it('lança quando a variação não existe', () => {
    expect(() => validateStock([legging], [{ productId: 'L', size: 'GG', color: 'Azul', quantity: 1 }]))
      .toThrow(/Estoque insuficiente/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test -- order.helpers`
Expected: FAIL (`validateStock` não exportado).

- [ ] **Step 3: Implementar `validateStock`**

Em `lib/data/order.helpers.ts`, adicionar ao final do arquivo:

```ts
export function validateStock(products: ProductWithVariants[], requested: RequestedItem[]): void {
  const byId = new Map(products.map((p) => [p.id, p]))
  for (const r of requested) {
    const p = byId.get(r.productId)
    if (!p) throw new Error(`Produto não encontrado: ${r.productId}`)
    const variant = p.variants.find((v) => v.size === r.size && v.color === r.color)
    const stock = variant?.stock ?? 0
    if (r.quantity > stock) {
      throw new Error(`Estoque insuficiente para ${p.name} (${r.size}/${r.color}). Restam ${stock}.`)
    }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm test -- order.helpers`
Expected: PASS.

- [ ] **Step 5: Chamar `validateStock` no `criarPedido`**

Em `app/_actions/criar-pedido.ts`, importar a função e chamá-la antes de `buildOrder`. Trocar o import:

```ts
import { buildOrder, type RequestedItem, type ChosenShipping, type ChosenPayment } from '@/lib/data/order.helpers'
```

por:

```ts
import { buildOrder, validateStock, type RequestedItem, type ChosenShipping, type ChosenPayment } from '@/lib/data/order.helpers'
```

E logo após a construção do array `products` (depois do `.map` que monta `products: ProductWithVariants[]`), adicionar:

```ts
  validateStock(products, input.items)
```

- [ ] **Step 6: Verificar build de tipos**

Run: `pnpm exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/data/order.helpers.ts lib/data/order.helpers.test.ts app/_actions/criar-pedido.ts
git commit -m "feat(pedido): valida estoque no servidor ao fechar o pedido"
```

---

## Verificação final

- [ ] **Rodar tudo:** `pnpm test && pnpm exec tsc --noEmit && pnpm build`
- [ ] **Smoke manual** com `pnpm dev`:
  - Painel: cadastrar produto com 3 fotos; editar e remover 1.
  - Vitrine: carrossel roda sozinho + arrasta; `+` trava no estoque; "só restam X".
  - Carrinho: `+` trava; botão "Enviar pelo WhatsApp" gera o PDF e abre compartilhar.
- [ ] **Lembrete de deploy:** rodar a 0012 no SQL Editor do Supabase ANTES de mergear na main.

## Notas

- A migration 0012 precisa estar aplicada no banco de dev para as Tasks 4/6/7/8/9 funcionarem em runtime; os testes unitários (Tasks 2/3/9) não dependem do banco.
- `embla-carousel-react` já está instalado — não é preciso instalar nada novo. O auto-rotate é feito com `setInterval` + `scrollNext()`, sem o plugin de autoplay.
