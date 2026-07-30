import { describe, it, expect, beforeEach, vi } from 'vitest'
import { login } from './actions'

const signInMock = vi.fn()
const redirectMock = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
let loginRateLimitOk = true
let loginIpRateLimitOk = true

vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '9.9.9.9' }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: signInMock } }),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: async (name: string) => {
    if (name === 'loginIp') return loginIpRateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }
    return loginRateLimitOk ? { ok: true } : { ok: false, error: 'Muitas tentativas.' }
  },
}))

function formData(email: string, password: string) {
  const fd = new FormData()
  fd.set('email', email)
  fd.set('password', password)
  return fd
}

beforeEach(() => {
  signInMock.mockReset()
  redirectMock.mockClear()
  loginRateLimitOk = true
  loginIpRateLimitOk = true
})

describe('login', () => {
  it('acima do limite (ip:email): redireciona pra login com erro de limite, sem chamar o Supabase', async () => {
    loginRateLimitOk = false
    await expect(login(formData('a@a.com', '123456'))).rejects.toThrow('REDIRECT:/painel/login?erro=limite')
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('acima do limite (só ip, password spraying contra várias contas): redireciona pra login com erro de limite, sem chamar o Supabase', async () => {
    loginIpRateLimitOk = false
    await expect(login(formData('a@a.com', '123456'))).rejects.toThrow('REDIRECT:/painel/login?erro=limite')
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('dentro do limite, credenciais corretas: redireciona pro painel', async () => {
    signInMock.mockResolvedValue({ error: null })
    await expect(login(formData('a@a.com', '123456'))).rejects.toThrow('REDIRECT:/painel')
  })

  it('dentro do limite, credenciais erradas: redireciona pro login com erro genérico', async () => {
    signInMock.mockResolvedValue({ error: { message: 'invalid' } })
    await expect(login(formData('a@a.com', 'errada'))).rejects.toThrow('REDIRECT:/painel/login?erro=1')
  })
})
