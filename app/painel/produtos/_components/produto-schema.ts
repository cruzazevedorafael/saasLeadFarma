// app/painel/produtos/_components/produto-schema.ts
import { z } from 'zod'

export const variantSchema = z.object({
  size: z.string().default(''),
  color: z.string().default(''),
  stock: z.number().int().min(0, 'Estoque não pode ser negativo'),
})

export const produtoSchema = z.object({
  code: z.string().default(''),
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().default(''),
  description: z.string().default(''),
  imageUrl: z.string().nullable().default(null),
  imageUrls: z.array(z.string()).max(5, 'Máximo de 5 fotos').default([]),
  priceWholesale: z.number().min(0),
  priceRetail: z.number().min(0),
  weightGrams: z.number().int().min(0).default(0),
  countsForWholesale: z.boolean().default(true),
  active: z.boolean().default(true),
  variants: z.array(variantSchema).default([]),
})

export type ProdutoInput = z.infer<typeof produtoSchema>
