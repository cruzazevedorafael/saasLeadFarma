// components/cart.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { Cart } from './cart'
import { useCartStore } from '@/lib/store'
import type { Product } from '@/lib/data/types'

vi.mock('@/app/_actions/criar-pedido', () => ({ criarPedido: vi.fn() }))
import { criarPedido } from '@/app/_actions/criar-pedido'
const criarPedidoMock = vi.mocked(criarPedido)

vi.mock('@/app/_actions/reserva-carrinho', () => ({
  reservarItem: vi.fn(async () => 99),
  liberarItem: vi.fn(async () => {}),
  liberarCarrinho: vi.fn(async () => {}),
}))

// jsdom não implementa matchMedia (framer-motion consulta pra reduced motion)
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as any
}

const legging: Product = {
  id: 'L', code: 'LEG-001', name: 'Legging', category: '', description: '', imageUrl: null, imageUrls: [],
  priceCost: 20, priceWholesale: 50, priceRetail: 90, weightGrams: 250, countsForWholesale: true,
  onPromo: false, promoPrice: 0, active: true, sortOrder: 0,
}

let openSpy: ReturnType<typeof vi.spyOn>

function preencherCheckoutEEnviar() {
  useCartStore.setState({ items: [{ product: legging, quantity: 2, size: 'M', color: 'Preto', maxStock: 5 }] })
  render(<Cart threshold={4} whatsappNumber="11 99999-9999" shippingMethods={[]} paymentMethods={[]} />)
  fireEvent.click(screen.getByText('Carrinho'))
  fireEvent.click(screen.getByText('Continuar'))
  fireEvent.change(screen.getByPlaceholderText('Digite seu nome'), { target: { value: 'Maria' } })
  fireEvent.change(screen.getByPlaceholderText('(00) 00000-0000'), { target: { value: '11988887777' } })
  fireEvent.click(screen.getByRole('button', { name: /Enviar pelo WhatsApp/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window) as any
})

afterEach(() => {
  cleanup()
  useCartStore.setState({ items: [] })
})

describe('Cart - envio do pedido', () => {
  it('registro falhou (ok false): mostra o erro, NÃO abre o WhatsApp e mantém o carrinho', async () => {
    criarPedidoMock.mockResolvedValue({ ok: false, error: 'Não foi possível registrar o pedido. Verifique sua internet e tente de novo.' })
    preencherCheckoutEEnviar()

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível registrar/)).toBeInTheDocument()
    })
    expect(openSpy).not.toHaveBeenCalled()

    // o carrinho não pode ser limpo (nem depois do setTimeout de 1s do fluxo de sucesso)
    await new Promise((r) => setTimeout(r, 1100))
    expect(useCartStore.getState().items).toHaveLength(1)
    // botão volta a ficar clicável pro cliente tentar de novo
    expect(screen.getByRole('button', { name: /Enviar pelo WhatsApp/i })).toBeEnabled()
  })

  it('registro lançou (rede caiu / deploy): mostra erro genérico e NÃO abre o WhatsApp', async () => {
    criarPedidoMock.mockRejectedValue(new Error('fetch failed'))
    preencherCheckoutEEnviar()

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível registrar/)).toBeInTheDocument()
    })
    expect(openSpy).not.toHaveBeenCalled()
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('registro ok: abre o WhatsApp com o número do pedido no texto', async () => {
    criarPedidoMock.mockResolvedValue({ ok: true, number: 42, total: 180, priceType: 'retail', stockWarning: null })
    preencherCheckoutEEnviar()

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    const url = String(openSpy.mock.calls[0][0])
    expect(url).toContain('https://wa.me/5511999999999')
    expect(url).toContain(encodeURIComponent('PEDIDO #42'))
  })

  it('registro ok com estoque insuficiente: abre o WhatsApp com o aviso no texto', async () => {
    criarPedidoMock.mockResolvedValue({
      ok: true, number: 43, total: 180, priceType: 'retail',
      stockWarning: 'Estoque insuficiente: Legging (M/Preto) — pedido 2, restam 1',
    })
    preencherCheckoutEEnviar()

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1))
    const url = String(openSpy.mock.calls[0][0])
    expect(url).toContain(encodeURIComponent('PEDIDO #43'))
    expect(url).toContain(encodeURIComponent('Estoque insuficiente: Legging (M/Preto)'))
    expect(url).toContain(encodeURIComponent('ATENÇÃO'))
  })
})
