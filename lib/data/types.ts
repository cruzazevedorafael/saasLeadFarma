export interface ProductVariant {
  id: string
  productId: string
  size: string
  color: string
  stock: number
}

export interface Product {
  id: string
  code: string
  name: string
  category: string
  description: string
  imageUrl: string | null
  imageUrls: string[]
  priceCost: number
  priceWholesale: number
  priceRetail: number
  weightGrams: number
  countsForWholesale: boolean
  active: boolean
  sortOrder: number
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[]
}
