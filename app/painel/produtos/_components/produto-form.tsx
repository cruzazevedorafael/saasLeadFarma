// app/painel/produtos/_components/produto-form.tsx
'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { produtoSchema, type ProdutoInput } from './produto-schema'
import { createProduto, updateProduto, uploadProdutoImage } from '../actions'
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
  const [imageUrl, setImageUrlState] = useState<string | null>(produto?.imageUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<ProdutoInput>({
    resolver: zodResolver(produtoSchema),
    defaultValues: produto
      ? {
          code: produto.code, name: produto.name, category: produto.category, description: produto.description,
          priceCost: produto.priceCost, priceWholesale: produto.priceWholesale, priceRetail: produto.priceRetail,
          weightGrams: produto.weightGrams,
          countsForWholesale: produto.countsForWholesale, active: produto.active, imageUrl: produto.imageUrl,
          variants: produto.variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
        }
      : {
          code: '', name: '', category: '', description: '',
          priceCost: 0, priceWholesale: 0, priceRetail: 0,
          weightGrams: 0,
          countsForWholesale: true, active: true, imageUrl: null,
          variants: [{ size: '', color: '', stock: 0 }],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setSubmitError(null)
    try {
      const url = await uploadProdutoImage(file)
      setImageUrlState(url)
      setValue('imageUrl', url)
    } catch {
      setSubmitError('Falha ao subir a foto.')
    } finally {
      setUploading(false)
    }
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
        <Label>Foto</Label>
        {imageUrl && <img src={imageUrl} alt="" className="h-32 w-32 rounded-lg object-cover" />}
        <Input type="file" accept="image/*" onChange={onUpload} disabled={uploading} />
        {uploading && <p className="text-xs text-muted-foreground">Subindo...</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="code">Número/Código</Label>
          <Input id="code" {...register('code')} />
          {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label htmlFor="priceCost">Custo</Label>
          <Input id="priceCost" type="number" step="0.01" {...register('priceCost', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="priceWholesale">Atacado</Label>
          <Input id="priceWholesale" type="number" step="0.01" {...register('priceWholesale', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="priceRetail">Varejo</Label>
          <Input id="priceRetail" type="number" step="0.01" {...register('priceRetail', { valueAsNumber: true })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="weightGrams">Peso (g)</Label>
          <Input id="weightGrams" type="number" step="1" {...register('weightGrams', { valueAsNumber: true })} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="countsForWholesale"
          checked={watch('countsForWholesale')}
          onCheckedChange={(v) => setValue('countsForWholesale', v === true)}
        />
        <Label htmlFor="countsForWholesale" className="text-sm">
          Esta peça conta pro atacado (desmarque para meias/brindes)
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="active" checked={watch('active')} onCheckedChange={(v) => setValue('active', v)} />
        <Label htmlFor="active" className="text-sm">Ativo (aparece no site)</Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Variações (tamanho + cor + estoque)</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ size: '', color: '', stock: 0 })}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
        {fields.map((field, i) => (
          <div key={field.id} className="flex gap-2 items-start">
            <Input placeholder="Tamanho" {...register(`variants.${i}.size`)} />
            <Input placeholder="Cor" {...register(`variants.${i}.color`)} />
            <Input placeholder="Estoque" type="number" {...register(`variants.${i}.stock`, { valueAsNumber: true })} />
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {errors.variants && <p className="text-xs text-destructive">{(errors.variants.message as string) ?? 'Verifique as variações'}</p>}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
        <Button type="button" variant="outline" onClick={() => router.push('/painel/produtos')}>Cancelar</Button>
      </div>
    </form>
  )
}
