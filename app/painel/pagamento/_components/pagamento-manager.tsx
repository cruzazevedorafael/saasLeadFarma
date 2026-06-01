// app/painel/pagamento/_components/pagamento-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPayment, updatePayment, deletePayment } from '../actions'
import type { PaymentMethod } from '@/lib/data/payment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trash2, Plus } from 'lucide-react'

export function PagamentoManager({ metodos }: { metodos: PaymentMethod[] }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [percent, setPercent] = useState('0')
  const [fixed, setFixed] = useState('0')
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
        onSubmit={(e) => { e.preventDefault(); run(async () => { await createPayment(nome, Number(percent), Number(fixed)); setNome(''); setPercent('0'); setFixed('0') }) }}
        className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
      >
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input placeholder="Ex: Cartão 3x" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Acréscimo %</Label>
          <Input type="number" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="h-11 w-24" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">+ R$ fixo</Label>
          <Input type="number" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} className="h-11 w-24" />
        </div>
        <Button type="submit" disabled={busy || !nome.trim()} className="h-11">
          <Plus className="h-4 w-4 mr-1" /> Criar
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {metodos.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma forma de pagamento ainda.</p>
      ) : (
        <ul className="space-y-2">
          {metodos.map((m) => (
            <PagamentoRow key={m.id} m={m} busy={busy} run={run} />
          ))}
        </ul>
      )}
    </div>
  )
}

function PagamentoRow({ m, busy, run }: { m: PaymentMethod; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const [nome, setNome] = useState(m.name)
  const [percent, setPercent] = useState(String(m.surchargePercent))
  const [fixed, setFixed] = useState(String(m.surchargeFixed))
  const [active, setActive] = useState(m.active)
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-10 flex-1 min-w-[140px]" />
      <Input type="number" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} className="h-10 w-20" title="Acréscimo %" />
      <Input type="number" step="0.01" value={fixed} onChange={(e) => setFixed(e.target.value)} className="h-10 w-20" title="+ R$ fixo" />
      <div className="flex items-center gap-1">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">Ativo</span>
      </div>
      <Button size="sm" disabled={busy}
        onClick={() => run(async () => { await updatePayment(m.id, nome, Number(percent), Number(fixed), active) })}>
        Salvar
      </Button>
      <Button size="icon" variant="ghost" disabled={busy}
        onClick={() => run(async () => { await deletePayment(m.id) })}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </li>
  )
}
