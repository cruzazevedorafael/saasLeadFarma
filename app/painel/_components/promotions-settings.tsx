'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress-image'
import { uploadPromotionImage, addPromotion, removePromotion, movePromotion } from '../promotions-actions'
import { MAX_PROMOTIONS, type Promotion } from '@/lib/data/promotions.types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react'

export function PromotionsSettings({ promotions }: { promotions: Promotion[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const atLimit = promotions.length >= MAX_PROMOTIONS

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setError(null)
    try {
      const compressed = await compressImage(file)
      const url = await uploadPromotionImage(compressed)
      const r = await addPromotion(url)
      if (!r.ok) setError(r.error ?? 'Falha ao adicionar.')
      else router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao subir a imagem.')
    } finally { setBusy(false) }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await fn(); router.refresh() }
    catch { setError('Falha na operação.') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Promoções do catálogo</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{promotions.length}/{MAX_PROMOTIONS}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Até {MAX_PROMOTIONS} imagens em carrossel no topo do catálogo. Ordene com as setas. Sem promoções, mostra o destaque padrão.
      </p>

      {promotions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {promotions.map((p, i) => (
            <div key={p.id} className="group relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt={`Promoção ${i + 1}`} className="aspect-video w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 p-1 opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-1">
                  <button type="button" disabled={busy || i === 0} onClick={() => act(() => movePromotion(p.id, 'up'))}
                    className="rounded bg-white/15 p-1 text-white disabled:opacity-30" aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={busy || i === promotions.length - 1} onClick={() => act(() => movePromotion(p.id, 'down'))}
                    className="rounded bg-white/15 p-1 text-white disabled:opacity-30" aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                </div>
                <button type="button" disabled={busy} onClick={() => act(() => removePromotion(p.id))}
                  className="rounded bg-destructive/80 p-1 text-white disabled:opacity-40" aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 text-[10px] font-medium text-white">{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Input type="file" accept="image/*" onChange={onUpload} disabled={busy || atLimit} className="max-w-xs" />
        {busy && <span className="text-xs text-muted-foreground">Salvando…</span>}
      </div>
      {atLimit && <p className="text-xs text-amber-600">Limite de {MAX_PROMOTIONS} atingido. Remova uma para adicionar outra.</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
