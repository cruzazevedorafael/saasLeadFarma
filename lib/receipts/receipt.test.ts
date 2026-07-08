import { describe, it, expect } from 'vitest'
import { buildReceiptData, buildReceiptText, pharmacyAddress } from './receipt'
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'

const pharmacy: Pharmacy = {
  id: 'ph1', slug: 'farmacia-teste', nomeExibicao: 'Farmácia Bem Estar', logoUrl: null,
  whatsappNumber: '5511999998888', bannerImageUrl: '', wholesaleThreshold: 4,
  status: 'active', onboardingCompleted: true,
  razaoSocial: 'Bem Estar Comércio de Medicamentos LTDA', nomeFantasia: 'Farmácia Bem Estar',
  cnpj: '12.345.678/0001-90', cep: '01001-000', logradouro: 'Praça da Sé', numero: '100',
  bairro: 'Sé', cidade: 'São Paulo', uf: 'SP', telefone: '(11) 3333-4444',
  email: 'contato@bemestar.com', farmaceuticoResponsavel: 'Ana Souza', crf: 'SP-12345',
  plan: 'pro', subscriptionStatus: 'active', trialEndsAt: null, asaasCustomerId: null, asaasSubscriptionId: null,
}

const order: OrderWithItems = {
  id: 'o1', number: 42, customerName: 'Maria Silva', customerPhone: '11988887777',
  customerCpf: '52998224725', customerCep: '04567-000', customerLogradouro: 'Av Paulista',
  customerNumero: '1000', customerComplemento: 'ap 5', customerBairro: 'Bela Vista',
  customerCidade: 'São Paulo', customerUf: 'SP',
  status: 'pending', priceType: 'retail', total: 33.4, itemsSubtotal: 33.4,
  shippingLabel: 'Retirada', shippingPrice: 0, paymentLabel: 'Pix', paymentSurcharge: 0,
  stockWarning: null, weightTotalGrams: 0, createdAt: '2026-07-08T12:00:00Z',
  completedAt: null, cancelledAt: null,
  items: [
    { id: 'i1', productId: 'p1', variantId: 'v1', productCode: '7891058014957', productName: 'Dipirona',
      size: 'Caixa 10 comp.', color: '500 mg', quantity: 2, unitPrice: 8.9, unitCost: 0, weightGrams: 0, imageUrl: null },
    { id: 'i2', productId: 'p2', variantId: 'v2', productCode: '', productName: 'Vitamina C',
      size: 'Tubo 10 comp.', color: '1 g', quantity: 1, unitPrice: 15.6, unitCost: 0, weightGrams: 0, imageUrl: null },
  ],
}

describe('receipt', () => {
  it('pharmacyAddress monta endereço legível', () => {
    expect(pharmacyAddress(pharmacy)).toBe('Praça da Sé, 100 · Sé · São Paulo/SP · CEP 01001-000')
  })

  it('buildReceiptData traz dados cadastrais da farmácia e do cliente', () => {
    const d = buildReceiptData(order, pharmacy)
    expect(d.pharmacyName).toBe('Farmácia Bem Estar')
    expect(d.pharmacyCnpj).toBe('12.345.678/0001-90')
    expect(d.pharmacyResponsavel).toBe('Farm. Ana Souza — CRF SP-12345')
    expect(d.customerCpf).toBe('52998224725')
    expect(d.items).toHaveLength(2)
    expect(d.items[0].presentation).toBe('Caixa 10 comp.')
    expect(d.items[0].dosage).toBe('500 mg')
  })

  it('buildReceiptText inclui farmácia, cliente (CPF mascarado), itens e total', () => {
    const t = buildReceiptText(buildReceiptData(order, pharmacy))
    expect(t).toContain('FARMÁCIA BEM ESTAR')
    expect(t).toContain('CNPJ: 12.345.678/0001-90')
    expect(t).toContain('PEDIDO #42')
    expect(t).toContain('529.982.247-25')
    expect(t).toContain('1. Dipirona (7891058014957)')
    expect(t).toContain('Apres.: Caixa 10 comp. · Dosagem: 500 mg')
    expect(t).toContain('TOTAL: R$ 33,40')
  })
})
