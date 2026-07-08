'use client'

import { useState } from 'react'
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { buildReceiptData, buildReceiptText } from '@/lib/receipts/receipt'
import { buildReceiptPdf58mm } from '@/lib/receipts/pdf-58mm'
import { Button } from '@/components/ui/button'
import { FileText, Receipt, ClipboardCopy, Check } from 'lucide-react'

function baixar(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function ComprovanteActions({ order, pharmacy }: { order: OrderWithItems; pharmacy: Pharmacy }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const data = buildReceiptData(order, pharmacy)

  const gerarA4 = async () => {
    setBusy('a4')
    try {
      // import dinâmico: jsPDF + canvas só carregam no clique (não pesam a página)
      const { buildReceiptPdfA4 } = await import('@/lib/receipts/pdf-a4')
      baixar(await buildReceiptPdfA4(data))
    } finally {
      setBusy(null)
    }
  }

  const gerar58 = () => {
    setBusy('58')
    try {
      baixar(buildReceiptPdf58mm(data))
    } finally {
      setBusy(null)
    }
  }

  const copiarTexto = async () => {
    const txt = buildReceiptText(data)
    try {
      await navigator.clipboard.writeText(txt)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      window.prompt('Copie o comprovante:', txt)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={gerarA4} disabled={busy === 'a4'}>
        <FileText className="h-4 w-4 mr-1.5" /> {busy === 'a4' ? 'Gerando...' : 'Comprovante A4'}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={gerar58} disabled={busy === '58'}>
        <Receipt className="h-4 w-4 mr-1.5" /> Cupom 58mm
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={copiarTexto}>
        {copiado ? <><Check className="h-4 w-4 mr-1.5" /> Copiado</> : <><ClipboardCopy className="h-4 w-4 mr-1.5" /> Texto</>}
      </Button>
    </div>
  )
}
