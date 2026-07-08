'use client'

import { useState } from 'react'
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { buildReceiptData, buildReceiptText } from '@/lib/receipts/receipt'
import { buildReceiptHtml } from '@/lib/receipts/html'
import { buildReceiptPdf58mm } from '@/lib/receipts/pdf-58mm'
import { Button } from '@/components/ui/button'
import { Send, Printer, FileText, Receipt, ClipboardCopy, Check } from 'lucide-react'

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

// 55 + DDD + número, só dígitos, sem duplicar o país.
function whatsappNumber(raw: string) {
  const d = (raw || '').replace(/\D/g, '').replace(/^0+/, '')
  if (d.startsWith('55') && d.length >= 12) return d
  return `55${d}`
}

export function ComprovanteActions({ order, pharmacy }: { order: OrderWithItems; pharmacy: Pharmacy }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const data = buildReceiptData(order, pharmacy)

  const enviarCliente = () => {
    const phone = whatsappNumber(order.customerPhone)
    const texto = encodeURIComponent(buildReceiptText(data))
    window.open(`https://wa.me/${phone}?text=${texto}`, '_blank')
  }

  const imprimir = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(buildReceiptHtml(data))
    w.document.close()
  }

  const gerarA4 = async () => {
    setBusy('a4')
    try {
      const { buildReceiptPdfA4 } = await import('@/lib/receipts/pdf-a4')
      baixar(await buildReceiptPdfA4(data))
    } finally {
      setBusy(null)
    }
  }

  const gerar58 = () => {
    setBusy('58')
    try { baixar(buildReceiptPdf58mm(data)) } finally { setBusy(null) }
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
    <div className="space-y-3">
      {/* Ações principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button type="button" onClick={enviarCliente} disabled={!order.customerPhone}
          className="h-11 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold">
          <Send className="h-4 w-4 mr-2" /> Enviar ao cliente
        </Button>
        <Button type="button" variant="outline" onClick={imprimir} className="h-11">
          <Printer className="h-4 w-4 mr-2" /> Imprimir
        </Button>
      </div>

      {/* Downloads / cópia */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={gerarA4} disabled={busy === 'a4'} className="text-muted-foreground">
          <FileText className="h-4 w-4 mr-1.5" /> {busy === 'a4' ? 'Gerando...' : 'PDF A4'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={gerar58} disabled={busy === '58'} className="text-muted-foreground">
          <Receipt className="h-4 w-4 mr-1.5" /> Cupom 58mm
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={copiarTexto} className="text-muted-foreground">
          {copiado ? <><Check className="h-4 w-4 mr-1.5" /> Copiado</> : <><ClipboardCopy className="h-4 w-4 mr-1.5" /> Copiar texto</>}
        </Button>
      </div>
      {!order.customerPhone && (
        <p className="text-xs text-muted-foreground">Este pedido não tem telefone do cliente — o envio direto fica indisponível.</p>
      )}
    </div>
  )
}
