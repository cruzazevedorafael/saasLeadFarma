// lib/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/lib/data/types'

export type { Product }

export interface CartItem {
  product: Product
  quantity: number
  size: string
  color: string
  maxStock?: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string, size: string, color: string) => void
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.product.id === item.product.id && i.size === item.size && i.color === item.color
          )
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
          return { items: [...state.items, item] }
        })
      },
      removeItem: (productId, size, color) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.product.id === productId && i.size === size && i.color === color)
          ),
        }))
      },
      updateQuantity: (productId, size, color, quantity) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId && i.size === size && i.color === color
              ? { ...i, quantity }
              : i
          ),
        }))
      },
      clearCart: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
    }),
    {
      name: 'karolla-cart',
    }
  )
)
