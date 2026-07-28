// Remove dado pessoal de cliente antes de qualquer evento sair pro Sentry —
// CPF/telefone/endereço não têm por que sair do nosso servidor. O que sobra
// (pharmacy_id, order_id, stack trace) já basta pra debugar. Usado pelos três
// arquivos de config do Sentry (sentry.server.config.ts, sentry.edge.config.ts,
// instrumentation-client.ts).
const PII_KEYS = new Set([
  'customer_cpf', 'customer_phone', 'customer_cep', 'customer_logradouro',
  'customer_numero', 'customer_complemento', 'customer_bairro',
  'cpf', 'phone', 'cep', 'logradouro', 'numero', 'complemento', 'bairro',
])

// Redação por CONTEÚDO, além da redação por chave acima. Cobre o caso em que
// PII vaza dentro de texto livre (ex.: PostgrestError é objeto plano — não
// Error — e quando um `throw error` desses chega ao Sentry, o event builder
// serializa o objeto inteiro em extra.__serialized__, preservando chaves como
// `details`/`message`/`hint` que não estão na PII_KEYS. Constraints do
// Postgres costumam ecoar o valor da linha na mensagem, ex.:
// "Key (cpf)=(52998224725) already exists."). Os \b nas bordas evitam casar
// um trecho de uma sequência numérica maior (ex.: um ID de 15 dígitos).
// Ordem importa: padrões mais específicos primeiro, pois cada regex roda em
// sequência sobre o resultado do anterior.
const PII_PATTERNS: RegExp[] = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, // CPF formatado: 000.000.000-00
  /\(\d{2}\)\s?\d{4,5}-?\d{4}/g, // telefone com DDD: (00) 00000-0000 ou (00) 0000-0000
  /\b\d{5}-\d{3}\b/g, // CEP formatado: 00000-000
  /\b\d{11}\b/g, // CPF ou celular sem formatação (11 dígitos)
  /\b\d{10}\b/g, // telefone fixo sem formatação (10 dígitos)
  /\b\d{8}\b/g, // CEP sem formatação (8 dígitos)
]

function redactPiiPatterns(s: string): string {
  return PII_PATTERNS.reduce((acc, re) => acc.replace(re, '[redacted]'), s)
}

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubValue)
  if (value && typeof value === 'object') return scrubObject(value as Record<string, unknown>)
  if (typeof value === 'string') return redactPiiPatterns(value)
  return value
}

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    out[key] = PII_KEYS.has(key) ? '[redacted]' : scrubValue(value)
  }
  return out
}

export function scrubPiiBeforeSend(event: any): any {
  if (event.extra) event.extra = scrubObject(event.extra)
  if (event.contexts) event.contexts = scrubObject(event.contexts)
  if (event.request?.data) event.request.data = scrubObject(event.request.data)
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => ({
      ...b,
      data: b.data ? scrubObject(b.data) : b.data,
    }))
  }
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((v: any) => (
      v && typeof v.value === 'string' ? { ...v, value: redactPiiPatterns(v.value) } : v
    ))
  }
  if (typeof event.message === 'string') event.message = redactPiiPatterns(event.message)
  return event
}
