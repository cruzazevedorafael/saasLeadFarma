import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from './store'

beforeEach(() => {
  useCartStore.setState({ items: [], cartId: '' })
})

describe('cartId', () => {
  it('ensureCartId gera um id na primeira vez e mantém nas seguintes', () => {
    const id1 = useCartStore.getState().ensureCartId()
    expect(id1).toBeTruthy()
    const id2 = useCartStore.getState().ensureCartId()
    expect(id2).toBe(id1)
    expect(useCartStore.getState().cartId).toBe(id1)
  })
})

describe('addItem guarda o variantId', () => {
  it('preserva o variantId passado', () => {
    const product: any = {
      id: 'L', code: 'LEG', name: 'Legging', category: '', description: '', imageUrl: null, imageUrls: [],
      priceCost: 0, priceWholesale: 50, priceRetail: 90, weightGrams: 250, countsForWholesale: true,
      onPromo: false, promoPrice: 0, active: true, sortOrder: 0,
    }
    useCartStore.getState().addItem({ product, quantity: 1, size: 'M', color: 'Preto', variantId: 'var-1', maxStock: 5 })
    expect(useCartStore.getState().items[0].variantId).toBe('var-1')
  })
})
