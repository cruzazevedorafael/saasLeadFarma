import { describe, it, expect, beforeEach, vi } from 'vitest'
import { autoCadastro } from './actions'

const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
const provisionMock = vi.fn()
let rateLimitOk = true

function fakeAdminDb() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
  }
}

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '5.5.5.5' }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signInWithPassword: vi.fn() } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeAdminDb() }))
vi.mock('@/lib/data/pharmacy-provisioning', () => ({ provisionPharmacy: (...args: any[]) => provisionMock(...args) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async () => (rateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }),
}))
vi.mock('@/lib/request-ip', () => ({
  getClientIp: async () => '5.5.5.5',
}))

const input = { nomeFantasia: 'Farmácia Teste', emailAdmin: 'a@a.com', senhaAdmin: '123456', whatsapp: '' }

beforeEach(() => {
  redirectMock.mockClear()
  provisionMock.mockReset()
  rateLimitOk = true
})

describe('autoCadastro', () => {
  it('acima do limite: devolve erro amigável, sem provisionar', async () => {
    rateLimitOk = false
    const r = await autoCadastro(input)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Muitas tentativas')
    expect(provisionMock).not.toHaveBeenCalled()
  })

  it('dentro do limite: provisiona e redireciona pro onboarding', async () => {
    provisionMock.mockResolvedValue({ ok: true })
    await expect(autoCadastro(input)).rejects.toThrow('REDIRECT:/painel/cadastro')
    expect(provisionMock).toHaveBeenCalled()
  })
})
