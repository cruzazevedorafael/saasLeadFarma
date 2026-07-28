// Rate limiting real (funciona entre múltiplas instâncias serverless) via
// Upstash Redis. Se as env vars não estiverem configuradas, falha aberto
// (deixa passar) e loga um erro — melhor que derrubar o app inteiro, mas
// NUNCA deve acontecer em produção depois que o Upstash for provisionado.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type Window = `${number} ${'s' | 'm' | 'h'}`

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null

function makeLimiter(requests: number, window: Window, prefix: string) {
  if (!redis) return null
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix })
}

const limiters = {
  login: makeLimiter(5, '15 m', 'rl:login'),
  cadastro: makeLimiter(5, '1 h', 'rl:cadastro'),
  buscarCliente: makeLimiter(5, '10 m', 'rl:buscar-cliente'),
  reservarItem: makeLimiter(30, '1 m', 'rl:reservar-item'),
  criarPedido: makeLimiter(10, '1 h', 'rl:criar-pedido'),
} as const

export type RateLimitName = keyof typeof limiters

export interface RateLimitResult {
  ok: boolean
  error?: string
}

export async function checkRateLimit(name: RateLimitName, key: string): Promise<RateLimitResult> {
  const limiter = limiters[name]
  if (!limiter) {
    console.error(`[rate-limit] Upstash não configurado — "${name}" está SEM proteção de rate limit.`)
    return { ok: true }
  }
  const { success } = await limiter.limit(key)
  if (!success) return { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }
  return { ok: true }
}
