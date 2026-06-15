// app/painel/pedidos/_components/pedido-actions.tsx
'use client'

import { useState, useTransition } from 'react'
import { darBaixa, cancelarPedido } from '../actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

export function PedidoActions({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const baixa = () =>
    startTransition(async () => {
      setErro(null)
      const r = await darBaixa(orderId)
      if (!r.ok) setErro(r.error ?? 'Erro ao dar baixa')
    })

  const cancelar = () =>
    startTransition(async () => {
      setErro(null)
      const r = await cancelarPedido(orderId)
      if (!r.ok) setErro(r.error ?? 'Erro ao cancelar')
    })

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="sm" onClick={baixa} disabled={pending} className="bg-[#CFFF04] text-black hover:bg-[#b8e600]">
          Dar baixa
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>Cancelar</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar este pedido?</AlertDialogTitle>
              <AlertDialogDescription>O pedido é cancelado e as peças voltam para o estoque.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={cancelar}>Cancelar pedido</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  )
}
