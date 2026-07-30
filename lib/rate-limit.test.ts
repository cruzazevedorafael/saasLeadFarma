import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const limitMock = vi.fn()

vi.mock('@upstash/redis', () => ({
  // Nota: implementação precisa ser `function`, não arrow function — o mock é
  // instanciado via `new Redis(...)` em lib/rate-limit.ts, e arrow functions
  // não são construtoras válidas em JS (Vitest 4 usa Reflect.construct internamente).
  Redis: vi.fn().mockImplementation(function () { return {} }),
}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn().mockImplementation(function () { return { limit: limitMock } }),
    { slidingWindow: vi.fn() },
  ),
}))

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.resetModules()
    limitMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sem Upstash configurado: deixa passar (fail-open) e loga aviso', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(true)
  })

  it('dentro do limite: permite', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')
    limitMock.mockResolvedValue({ success: true })
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(true)
  })

  it('acima do limite: bloqueia com mensagem amigável', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')
    limitMock.mockResolvedValue({ success: false })
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Muitas tentativas')
  })

  it('Upstash configurado mas fora do ar (limiter.limit lança): deixa passar (fail-open) e loga erro', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    limitMock.mockRejectedValue(new Error('upstash 5xx'))
    const { checkRateLimit } = await import('./rate-limit')
    const r = await checkRateLimit('login', '1.2.3.4')
    expect(r.ok).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
