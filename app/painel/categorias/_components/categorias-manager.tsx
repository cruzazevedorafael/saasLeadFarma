// app/painel/categorias/_components/categorias-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCategoria, renameCategoria, deleteCategoria } from '../actions'
import type { Category } from '@/lib/data/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Pencil, Plus, Check, X } from 'lucide-react'

export function CategoriasManager({ categorias }: { categorias: Category[] }) {
  const router = useRouter()
  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setErro(null); setBusy(true)
    try { await fn(); router.refresh() }
    catch (e: any) { setErro(e?.message ?? 'Erro') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); run(async () => { await createCategoria(novo); setNovo('') }) }}
        className="flex gap-2"
      >
        <Input placeholder="Nova categoria" value={novo} onChange={(e) => setNovo(e.target.value)} className="h-11" />
        <Button type="submit" disabled={busy || !novo.trim()} className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {categorias.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma categoria ainda. Crie a primeira acima.</p>
      ) : (
        <ul className="space-y-2">
          {categorias.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
              {editId === c.id ? (
                <>
                  <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-10" />
                  <Button size="icon" variant="ghost" disabled={busy}
                    onClick={() => run(async () => { await renameCategoria(c.id, c.name, editValue); setEditId(null) })}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setEditValue(c.name); setErro(null) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={busy}
                    onClick={() => run(async () => { await deleteCategoria(c.id, c.name) })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
