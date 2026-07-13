// app/painel/produtos/gtin-actions.ts — busca dados do produto por código de barras.
// Cascata: cache (banco) → Cosmos (env COSMOS_TOKEN, opcional) → Open Food/Beauty
// Facts (grátis) → não encontrado. Cache por EAN no banco (consulta 1x, serve sempre).
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'

export interface GtinResult {
  found: boolean
  gtin: string
  name?: string
  brand?: string
  category?: string
  imageUrl?: string
  pmc?: number | null
  source: 'cache' | 'cosmos' | 'off' | 'obf' | 'nao_encontrado'
}

function normalizeGtin(raw: string): string | null {
  const d = (raw || '').replace(/\D/g, '')
  return /^\d{8,14}$/.test(d) ? d : null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fromCosmos(gtin: string): Promise<Partial<GtinResult> | null> {
  const token = process.env.COSMOS_TOKEN
  if (!token) return null // Cosmos desligado até ter token
  try {
    const r = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${gtin}`, {
      headers: { 'X-Cosmos-Token': token, 'Content-Type': 'application/json' },
    })
    if (!r.ok) return null
    const d: any = await r.json()
    return {
      name: d.description ?? undefined,
      brand: d.brand?.name ?? undefined,
      category: d.gpc?.description ?? d.ncm?.description ?? undefined,
      imageUrl: d.thumbnail ?? undefined,
      source: 'cosmos',
    }
  } catch { return null }
}

async function fromOpenFacts(gtin: string): Promise<Partial<GtinResult> | null> {
  // Open Beauty Facts (higiene/cosmético) e Open Food Facts (grátis).
  const hosts: { url: string; source: 'obf' | 'off' }[] = [
    { url: `https://world.openbeautyfacts.org/api/v2/product/${gtin}.json`, source: 'obf' },
    { url: `https://world.openfoodfacts.org/api/v2/product/${gtin}.json`, source: 'off' },
  ]
  for (const h of hosts) {
    try {
      const r = await fetch(h.url, { headers: { 'User-Agent': 'LeadFarma/1.0 (+leadfarma.br@gmail.com)' } })
      if (!r.ok) continue
      const j: any = await r.json()
      if (j.status === 1 && j.product) {
        const p = j.product
        const name = p.product_name_pt || p.product_name || ''
        if (!name) continue
        return {
          name,
          brand: (p.brands || '').split(',')[0]?.trim() || undefined,
          category: (p.categories || '').split(',').pop()?.trim() || undefined,
          imageUrl: p.image_front_url || p.image_url || undefined,
          source: h.source,
        }
      }
    } catch { /* tenta o próximo */ }
  }
  return null
}

export async function buscarProdutoPorGtin(raw: string): Promise<GtinResult> {
  await getCurrentPharmacyId() // exige farmácia logada (protege a cota das APIs)
  const gtin = normalizeGtin(raw)
  if (!gtin) return { found: false, gtin: raw, source: 'nao_encontrado' }

  const db = createAdminClient()

  // 1) cache
  const { data: cached } = await db.from('gtin_cache').select('*').eq('gtin', gtin).maybeSingle()
  if (cached) {
    const found = cached.source !== 'nao_encontrado'
    return {
      found, gtin, name: cached.name ?? undefined, brand: cached.brand ?? undefined,
      category: cached.category ?? undefined, imageUrl: cached.image_url ?? undefined,
      pmc: cached.pmc ?? null, source: 'cache',
    }
  }

  // 2) Cosmos (se ligado) → 3) Open Facts (grátis)
  const hit = (await fromCosmos(gtin)) ?? (await fromOpenFacts(gtin))

  const result: GtinResult = hit
    ? { found: true, gtin, name: hit.name, brand: hit.brand, category: hit.category, imageUrl: hit.imageUrl, source: (hit.source as GtinResult['source']) ?? 'off' }
    : { found: false, gtin, source: 'nao_encontrado' }

  // 4) grava no cache (inclusive negativo, pra não re-consultar toda hora)
  await db.from('gtin_cache').upsert({
    gtin, name: result.name ?? null, brand: result.brand ?? null,
    category: result.category ?? null, image_url: result.imageUrl ?? null,
    pmc: result.pmc ?? null, source: result.found ? result.source : 'nao_encontrado',
    fetched_at: new Date().toISOString(),
  })

  return result
}
