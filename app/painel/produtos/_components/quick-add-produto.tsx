'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { quickAddProduto } from '../estoque-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

// Cadastro rápido "por fora": nome + preço + estoque. Sem o formulário completo.
export function QuickAddProduto() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () => {
    setError(null)
    start(async () => {
      const r = await quickAddProduto(name, Number(price.replace(',', '.')), Number(stock))
      if (!r.ok) { setError(r.error ?? 'Falha.'); return }
      setName(''); setPrice(''); setStock(''); setOpen(false); router.refresh()
    })
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Adicionar rápido
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[10rem]">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Dipirona 500mg" autoFocus />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground">Preço (R$)</label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00" />
        </div>
        <div className="w-24">
          <label className="text-xs text-muted-foreground">Estoque</label>
          <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" placeholder="0" />
        </div>
        <Button onClick={submit} disabled={pending || !name.trim()}>{pending ? 'Salvando…' : 'Adicionar'}</Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setError(null) }}>Cancelar</Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Cria com preço unitário. Detalhes (foto, categoria, atacado) você ajusta depois em Editar.</p>
    </div>
  )
}
