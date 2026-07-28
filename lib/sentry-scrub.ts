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

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubValue)
  if (value && typeof value === 'object') return scrubObject(value as Record<string, unknown>)
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
  return event
}
