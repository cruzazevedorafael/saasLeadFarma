import { describe, it, expect } from 'vitest'
import { scrubPiiBeforeSend } from './sentry-scrub'

describe('scrubPiiBeforeSend', () => {
  it('redige campos de PII em extra, mantendo o resto', () => {
    const event = {
      extra: {
        pharmacyId: 'ph1',
        orderId: 'o1',
        customer_cpf: '52998224725',
        customer_phone: '11988887777',
        customer_cep: '01310100',
        customer_logradouro: 'Av. Paulista',
        customer_numero: '1000',
        customer_complemento: 'Apto 1',
        customer_bairro: 'Bela Vista',
      },
    }
    const result = scrubPiiBeforeSend(event)
    expect(result.extra.pharmacyId).toBe('ph1')
    expect(result.extra.orderId).toBe('o1')
    expect(result.extra.customer_cpf).toBe('[redacted]')
    expect(result.extra.customer_phone).toBe('[redacted]')
    expect(result.extra.customer_cep).toBe('[redacted]')
    expect(result.extra.customer_logradouro).toBe('[redacted]')
    expect(result.extra.customer_numero).toBe('[redacted]')
    expect(result.extra.customer_complemento).toBe('[redacted]')
    expect(result.extra.customer_bairro).toBe('[redacted]')
  })

  it('redige PII aninhada dentro de request.data', () => {
    const event = {
      request: {
        data: { customerName: 'Maria', customer_cpf: '52998224725', items: [{ productId: 'p1' }] },
      },
    }
    const result = scrubPiiBeforeSend(event)
    expect(result.request.data.customerName).toBe('Maria')
    expect(result.request.data.customer_cpf).toBe('[redacted]')
    expect(result.request.data.items).toEqual([{ productId: 'p1' }])
  })

  it('evento sem extra/request/contexts/breadcrumbs: devolve como veio, sem quebrar', () => {
    const event = { message: 'algo quebrou' }
    expect(scrubPiiBeforeSend(event)).toEqual({ message: 'algo quebrou' })
  })

  it('redige PII dentro de breadcrumbs', () => {
    const event = {
      breadcrumbs: [{ message: 'clique', data: { cpf: '52998224725', action: 'submit' } }],
    }
    const result = scrubPiiBeforeSend(event)
    expect(result.breadcrumbs[0].data.cpf).toBe('[redacted]')
    expect(result.breadcrumbs[0].data.action).toBe('submit')
  })
})
