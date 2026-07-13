'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setStockRapido } from '../estoque-actions'
import { Minus, Plus, Check } from 'lucide-react'

// Controle rápido de estoque na lista. Produto com >1 variação não é editável aqui
// (mostra o total e manda pro editor).
export function StockControl({ productId, initialStock, variantCount }: { productId: string; initialStock: number; variantCount: number }) {
  const router = useRouter()
  const [val, setVal] = useState(initialStock)
  const [pending, start] = useTransition()
  const [saved, setSaved] = useState(false)

  if (variantCount > 1) {
    return <span className="text-sm tabular-nums" title="Produto com variações — ajuste no editor">{initialStock} <span className="text-xs text-muted-foreground">(variações)</span></span>
  }

  const commit = (next: number) => {
    const v = Math.max(0, next)
    setVal(v)
    start(async () => {
      const r = await setStockRapido(productId, v)
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); router.refresh() }
    })
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" onClick={() => commit(val - 1)} disabled={pending || val <= 0}
        className="rounded-md border border-border p-1 hover:bg-accent disabled:opacity-40" aria-label="Diminuir">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number" min={0} value={val}
        onChange={(e) => setVal(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        onBlur={() => val !== initialStock && commit(val)}
        className="w-14 rounded-md border border-border bg-card px-1.5 py-1 text-center text-sm tabular-nums"
      />
      <button type="button" onClick={() => commit(val + 1)} disabled={pending}
        className="rounded-md border border-border p-1 hover:bg-accent disabled:opacity-40" aria-label="Aumentar">
        <Plus className="h-3.5 w-3.5" />
      </button>
      {saved && <Check className="h-4 w-4 text-green-600" />}
    </div>
  )
}
