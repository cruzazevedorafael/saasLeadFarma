// app/painel/pedidos/_components/pedido-actions.tsx
'use client'

import { useState, useTransition } from 'react'
import { darBaixa, cancelarPedido } from '../actions'
import { imprimirComprovante, enviarComprovantePdf } from '@/lib/receipts/client'
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'

export function PedidoActions({ order, pharmacy }: { order: OrderWithItems; pharmacy: Pharmacy }) {
  const [pending, startTransition] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  // Dá baixa e, opcionalmente, imprime + envia o comprovante ao cliente (sem abrir o pedido).
  const baixa = (comComprovante: boolean) =>
    startTransition(async () => {
      setErro(null)
      const r = await darBaixa(order.id)
      if (!r.ok) { setErro(r.error ?? 'Erro ao dar baixa'); return }
      if (comComprovante) {
        imprimirComprovante(order, pharmacy)
        await enviarComprovantePdf(order, pharmacy).catch(() => {})
      }
    })

  const cancelar = () =>
    startTransition(async () => {
      setErro(null)
      const r = await cancelarPedido(order.id)
      if (!r.ok) setErro(r.error ?? 'Erro ao cancelar')
    })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Dar baixa → pergunta sobre o comprovante */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={pending} className="bg-primary text-primary-foreground hover:bg-brand-hover">
              Dar baixa
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Dar baixa no pedido #{order.number}</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja imprimir o comprovante e enviar o PDF ao cliente ao dar baixa? Você não precisa abrir o pedido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={() => baixa(false)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Só dar baixa
              </AlertDialogAction>
              <AlertDialogAction onClick={() => baixa(true)}>
                Baixa + imprimir e enviar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
