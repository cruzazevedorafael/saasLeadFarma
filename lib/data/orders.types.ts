// lib/data/orders.types.ts
export type OrderStatus = 'pending' | 'completed' | 'cancelled'
export type OrderPriceType = 'retail' | 'wholesale'

export interface OrderItem {
  id: string
  productId: string | null
  variantId: string | null
  productCode: string
  productName: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export interface OrderWithItems {
  id: string
  number: number
  customerName: string
  customerPhone: string
  status: OrderStatus
  priceType: OrderPriceType
  total: number
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
}
