// app/painel/produtos/_components/produto-actions.tsx
'use client'

import { useState, useTransition } from 'react'
import { setProdutoActive, deleteProduto } from '../actions'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

export function ProdutoActions({ id, active }: { id: string; active: boolean }) {
  const [isActive, setIsActive] = useState(active)
  const [pending, startTransition] = useTransition()

  const toggle = (v: boolean) => {
    setIsActive(v)
    startTransition(() => { setProdutoActive(id, v) })
  }
  const onDelete = () => startTransition(() => { deleteProduto(id) })

  return (
    <div className="flex items-center gap-2">
      <Switch checked={isActive} onCheckedChange={toggle} disabled={pending} aria-label="Ativo" />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. As variações também serão removidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
