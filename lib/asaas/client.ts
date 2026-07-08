// lib/asaas/client.ts — integração ASAAS (cobrança/assinaturas), ativada por env.
//
// A cobrança só liga quando ASAAS_API_KEY existe. Sem a chave, o SaaS opera em
// modo "manual/teste" (farmácias em trial/ativas sem cobrança) — o cliente
// aprova o SaaS e depois pluga as credenciais, sem mudar o resto do código.
//
// Variáveis (.env.local, quando aprovado):
//   ASAAS_API_KEY   = $aact_...            (chave da conta ASAAS)
//   ASAAS_ENV       = sandbox | production (default sandbox)
//   ASAAS_WEBHOOK_TOKEN = token que valida os webhooks

export function asaasEnabled(): boolean {
  return !!process.env.ASAAS_API_KEY
}

function baseUrl(): string {
  return process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3'
}

export interface AsaasResult<T> {
  ok: boolean
  data?: T
  error?: string
}

// Chamada genérica à API do ASAAS. Retorna {ok:false} se a integração está
// desligada (sem chave), pra quem chama tratar como "modo manual".
export async function asaasFetch<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<AsaasResult<T>> {
  const key = process.env.ASAAS_API_KEY
  if (!key) return { ok: false, error: 'ASAAS desativado (sem ASAAS_API_KEY)' }
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', access_token: key },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    })
    const json = (await res.json().catch(() => ({}))) as T & { errors?: { description: string }[] }
    if (!res.ok) {
      const msg = (json as { errors?: { description: string }[] })?.errors?.[0]?.description
      return { ok: false, error: msg ?? `ASAAS ${res.status}` }
    }
    return { ok: true, data: json }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede no ASAAS' }
  }
}
