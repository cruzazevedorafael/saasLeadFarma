// app/painel/produtos/gtin-actions.test.ts
// Regressão do envenenamento de cache: um timeout/erro transitório da API externa NÃO
// pode gravar "nao_encontrado" no gtin_cache (que é global entre todas as farmácias e não
// expira). Só cacheia negativo quando o provedor confirma que o EAN realmente não existe.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buscarProdutoPorGtin } from './gtin-actions'

let upserts: any[] = []

function fakeDb() {
  return {
    from(table: string) {
      if (table !== 'gtin_cache') throw new Error(`tabela inesperada no teste: ${table}`)
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        upsert: async (row: any) => { upserts.push(row); return { error: null } },
      }
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))
vi.mock('@/lib/auth/guards', () => ({ getCurrentPharmacyId: async () => 'ph1' }))

const GTIN = '7891058014957'

beforeEach(() => {
  upserts = []
  delete process.env.COSMOS_TOKEN // Cosmos desligado → só Open Facts roda
  vi.restoreAllMocks()
})

describe('buscarProdutoPorGtin — cache de código de barras', () => {
  it('erro de rede em todos os provedores NÃO grava "nao_encontrado" no cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network timeout')))

    const r = await buscarProdutoPorGtin(GTIN)

    expect(r.found).toBe(false)
    expect(upserts).toHaveLength(0) // nada foi cacheado — a próxima leitura tenta de novo
  })

  it('provedor responde "não existe" (status 0) grava "nao_encontrado" no cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ status: 0 }),
    }))

    const r = await buscarProdutoPorGtin(GTIN)

    expect(r.found).toBe(false)
    expect(upserts).toHaveLength(1)
    expect(upserts[0].source).toBe('nao_encontrado')
  })

  it('provedor encontra o produto grava o positivo no cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ status: 1, product: { product_name: 'Dipirona 500mg', brands: 'EMS' } }),
    }))

    const r = await buscarProdutoPorGtin(GTIN)

    expect(r.found).toBe(true)
    expect(r.name).toBe('Dipirona 500mg')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].source).not.toBe('nao_encontrado')
  })
})
