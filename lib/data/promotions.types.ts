// lib/data/promotions.types.ts — tipos/const sem dependência de servidor (usável no client).
export const MAX_PROMOTIONS = 10

export interface Promotion {
  id: string
  imageUrl: string
  sortOrder: number
  active: boolean
}
