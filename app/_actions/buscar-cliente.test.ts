import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buscarClientePorCpf } from './buscar-cliente'

let customerRow: any = null
let rateLimitOk = true
let dbWasCalled = false

function fakeDb() {
  return {
    from() {
      dbWasCalled = true
      return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: customerRow }) }) }) }) }
    },
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '7.7.7.7' }) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))

beforeEach(() => {
  customerRow = { name: 'Maria', phone: '11988887777', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', lgpd_consent: true }
  rateLimitOk = true
  dbWasCalled = false
})

describe('buscarClientePorCpf', () => {
  it('acima do limite: devolve null consultando o banco (timing indistinto)', async () => {
    rateLimitOk = false
    const r = await buscarClientePorCpf('ph1', '52998224725', '7777')
    expect(r).toBeNull()
    // Verify DB was called (for timing indistinguishability from other null-returning paths)
    expect(dbWasCalled).toBe(true)
  })

  it('dentro do limite, CPF e 2ª prova corretos: devolve o cadastro', async () => {
    const r = await buscarClientePorCpf('ph1', '52998224725', '7777')
    expect(r?.name).toBe('Maria')
  })
})
