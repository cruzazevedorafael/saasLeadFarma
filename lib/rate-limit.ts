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
  // `timeout` é suportado nativamente pelo @upstash/ratelimit: se o Redis não
  // responder dentro desse prazo, a lib já deixa passar (fail-open) sem lançar.
  // Deixamos explícito (em vez de confiar no default de 5000ms) pra o intent
  // ficar claro no código. Isso cobre timeouts; erros de rede/5xx lançados
  // sincronamente ainda passam pelo try/catch em checkRateLimit abaixo.
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix, timeout: 3000 })
}

const limiters = {
  login: makeLimiter(5, '15 m', 'rl:login'),
  // Limite mais largo, só por IP — segunda camada contra password spraying
  // (várias contas diferentes do mesmo IP) e contra travar a conta de uma
  // vítima específica (o limite `login` é por par ip:email). Ver checkRateLimit
  // em app/painel/login/actions.ts: os dois precisam passar.
  loginIp: makeLimiter(20, '15 m', 'rl:login-ip'),
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
  try {
    const { success } = await limiter.limit(key)
    if (!success) return { ok: false, error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }
    return { ok: true }
  } catch (err) {
    // Upstash fora do ar/erro transitório: falha ABERTA (deixa passar) em vez
    // de derrubar login/checkout/carrinho pra todo mundo por causa de uma
    // instabilidade do provedor de rate limit. Mesma postura do caso "Upstash
    // não configurado" acima.
    console.error(`[rate-limit] erro ao consultar Upstash para "${name}" — deixando passar (fail-open):`, err)
    return { ok: true }
  }
}
