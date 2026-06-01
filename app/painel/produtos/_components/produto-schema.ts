// app/painel/produtos/_components/produto-schema.ts
import { z } from 'zod'

export const variantSchema = z.object({
  size: z.string().min(1, 'Tamanho obrigatório'),
  color: z.string().min(1, 'Cor obrigatória'),
  stock: z.number().int().min(0, 'Estoque não pode ser negativo'),
})

export const produtoSchema = z.object({
  code: z.string().min(1, 'Código obrigatório'),
  name: z.string().min(1, 'Nome obrigatório'),
  category: z.string().default(''),
  description: z.string().default(''),
  imageUrl: z.string().nullable().default(null),
  priceCost: z.number().min(0),
  priceWholesale: z.number().min(0),
  priceRetail: z.number().min(0),
  countsForWholesale: z.boolean().default(true),
  active: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, 'Adicione ao menos uma variação'),
})

export type ProdutoInput = z.infer<typeof produtoSchema>
