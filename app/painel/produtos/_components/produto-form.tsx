// app/painel/produtos/_components/produto-form.tsx
'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { produtoSchema, type ProdutoInput } from './produto-schema'
import { createProduto, updateProduto, uploadProdutoImage } from '../actions'
import { compressImage } from '@/lib/compress-image'
import type { ProductWithVariants } from '@/lib/data/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2 } from 'lucide-react'

export function ProdutoForm({ mode, produto, categorias }: { mode: 'create' | 'edit'; produto?: ProductWithVariants; categorias: string[] }) {
  const router = useRouter()
  const [imageUrls, setImageUrlsState] = useState<string[]>(
    produto?.imageUrls?.length ? produto.imageUrls : produto?.imageUrl ? [produto.imageUrl] : []
  )
  const MAX_FOTOS = 5
  const [uploading, setUploading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<ProdutoInput>({
    resolver: zodResolver(produtoSchema),
    defaultValues: produto
      ? {
          code: produto.code, name: produto.name, brand: produto.brand, requiresPrescription: produto.requiresPrescription,
          category: produto.category, description: produto.description,
          priceWholesale: produto.priceWholesale, priceRetail: produto.priceRetail, hasWholesale: produto.hasWholesale,
          weightGrams: produto.weightGrams,
          onPromo: produto.onPromo, promoPrice: produto.promoPrice,
          countsForWholesale: produto.countsForWholesale, active: produto.active, imageUrl: produto.imageUrl,
          imageUrls: produto.imageUrls?.length ? produto.imageUrls : produto.imageUrl ? [produto.imageUrl] : [],
          variants: produto.variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
        }
      : {
          code: '', name: '', brand: '', requiresPrescription: false, category: '', description: '',
          priceWholesale: 0, priceRetail: 0, hasWholesale: true,
          weightGrams: 0,
          onPromo: false, promoPrice: 0,
          countsForWholesale: true, active: true, imageUrl: null, imageUrls: [],
          variants: [{ size: '', color: '', stock: 0 }],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })

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

  const onSubmit = async (data: ProdutoInput) => {
    setSubmitError(null)
    try {
      if (mode === 'edit' && produto) await updateProduto(produto.id, data)
      else await createProduto(data)
      router.push('/painel/produtos')
      router.refresh()
    } catch {
      setSubmitError('Erro ao salvar. Verifique os dados (código duplicado?).')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="container mx-auto p-4 md:p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">{mode === 'edit' ? 'Editar produto' : 'Novo produto'}</h1>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Fotos — a 1ª é a capa</Label>
          <span className={`text-xs font-medium ${imageUrls.length > 0 ? 'text-[#F97316]' : 'text-muted-foreground'}`}>
            {imageUrls.length} de {MAX_FOTOS} foto{imageUrls.length !== 1 ? 's' : ''}
          </span>
        </div>
        {imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-[#F97316] px-1 text-[10px] font-medium text-black">capa</span>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="code">Cód. de barras (EAN) / código (opcional)</Label>
          <Input id="code" inputMode="numeric" {...register('code')} />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="brand">Marca / Laboratório</Label>
        <Input id="brand" placeholder="Ex.: EMS, Medley, Neo Química..." {...register('brand')} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="category">Categoria</Label>
        <select
          id="category"
          {...register('category')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="priceRetail">Preço unitário (R$)</Label>
          <Input id="priceRetail" type="number" step="0.01" {...register('priceRetail', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="weightGrams">Peso (g)</Label>
          <Input id="weightGrams" type="number" step="1" {...register('weightGrams', { valueAsNumber: true })} />
        </div>
      </div>

      {/* Preço por quantidade (atacado) — OPCIONAL por produto */}
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <Switch id="hasWholesale" checked={watch('hasWholesale')} onCheckedChange={(v) => setValue('hasWholesale', v)} />
          <Label htmlFor="hasWholesale" className="text-sm">Tem preço por quantidade (atacado)?</Label>
        </div>
        {watch('hasWholesale') && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1 max-w-[14rem]">
              <Label htmlFor="priceWholesale" className="text-sm">Preço por quantidade (R$)</Label>
              <Input id="priceWholesale" type="number" step="0.01" {...register('priceWholesale', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">Vale quando o carrinho atinge a quantidade definida no painel.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="countsForWholesale" checked={watch('countsForWholesale')} onCheckedChange={(v) => setValue('countsForWholesale', v === true)} />
              <Label htmlFor="countsForWholesale" className="text-sm">Este item conta para atingir a quantidade de atacado</Label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center gap-2">
          <Switch
            id="onPromo"
            checked={watch('onPromo')}
            onCheckedChange={(v) => setValue('onPromo', v)}
          />
          <Label htmlFor="onPromo" className="text-sm">Em promoção (destaca o produto no catálogo)</Label>
        </div>
        {watch('onPromo') && (
          <div className="space-y-1">
            <Label htmlFor="promoPrice">Preço promocional (R$)</Label>
            <Input id="promoPrice" type="number" step="0.01" className="max-w-[12rem]" {...register('promoPrice', { valueAsNumber: true })} />
            <p className="text-xs text-muted-foreground">O cliente vê só este preço, no balão de promoção (vale para qualquer quantidade).</p>
            {errors.promoPrice && <p className="text-xs text-destructive">{errors.promoPrice.message}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <Switch
          id="requiresPrescription"
          checked={watch('requiresPrescription')}
          onCheckedChange={(v) => setValue('requiresPrescription', v)}
        />
        <Label htmlFor="requiresPrescription" className="text-sm">
          Exige receita médica (mostra selo no catálogo)
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="countsForWholesale"
          checked={watch('countsForWholesale')}
          onCheckedChange={(v) => setValue('countsForWholesale', v === true)}
        />
        <Label htmlFor="countsForWholesale" className="text-sm">
          Conta para o preço por quantidade (desmarque para itens avulsos)
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="active" checked={watch('active')} onCheckedChange={(v) => setValue('active', v)} />
        <Label htmlFor="active" className="text-sm">Ativo (aparece no site)</Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Apresentações (apresentação + dosagem + estoque)</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ size: '', color: '', stock: 0 })}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Ex.: apresentação “Caixa 20 comp.”, dosagem “500 mg”. O estoque é controlado por apresentação.</p>
        {fields.map((field, i) => (
          <div key={field.id} className="flex gap-2 items-start">
            <Input placeholder="Apresentação" {...register(`variants.${i}.size`)} />
            <Input placeholder="Dosagem" {...register(`variants.${i}.color`)} />
            <Input placeholder="Estoque" type="number" {...register(`variants.${i}.stock`, { valueAsNumber: true })} />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {errors.variants && <p className="text-xs text-destructive">{(errors.variants.message as string) ?? 'Verifique as apresentações'}</p>}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        <Button type="button" variant="outline" onClick={() => router.push('/painel/produtos')}>Cancelar</Button>
      </div>
    </form>
  )
}
