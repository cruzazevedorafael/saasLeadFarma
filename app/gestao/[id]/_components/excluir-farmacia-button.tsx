'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { excluirFarmacia } from '../../actions'
import { Button } from '@/components/ui/button'

export function ExcluirFarmaciaButton({ id, nome }: { id: string; nome: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function onClick() {
    // Confirmação dupla — operação destrutiva e irreversível.
    if (!window.confirm(
      `Excluir a farmácia "${nome}"?\n\nIsto apaga PERMANENTEMENTE produtos, pedidos, clientes e os logins ligados a ela. Não há como desfazer.`
    )) return
    if (!window.confirm('Tem certeza absoluta? Esta ação é irreversível.')) return

    setBusy(true); setErro(null)
    const r = await excluirFarmacia(id)
    if (!r.ok) { setErro(r.error); setBusy(false); return }
    router.push('/gestao')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onClick}
        className="border-destructive text-destructive hover:bg-destructive hover:text-white"
      >
        {busy ? 'Excluindo...' : 'Excluir farmácia'}
      </Button>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  )
}
