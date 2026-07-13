// lib/receipts/client.ts — ações de comprovante no navegador (imprimir / enviar PDF).
// Reutilizado no detalhe do pedido e no "dar baixa" da lista.
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { buildReceiptData, buildReceiptText } from './receipt'
import { buildReceiptHtml } from './html'

/** Abre a janela de impressão do comprovante (HTML → imprimir/salvar PDF). */
export function imprimirComprovante(order: OrderWithItems, pharmacy: Pharmacy) {
  const data = buildReceiptData(order, pharmacy)
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(buildReceiptHtml(data))
  w.document.close()
}

function whatsappNumber(raw: string) {
  const d = (raw || '').replace(/\D/g, '').replace(/^0+/, '')
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`
}

/** Envia o PDF do comprovante ao cliente. Usa Web Share (celular → WhatsApp com o
 *  arquivo); onde não houver, baixa o PDF e abre o WhatsApp com o texto pra anexar. */
export async function enviarComprovantePdf(order: OrderWithItems, pharmacy: Pharmacy): Promise<boolean> {
  const data = buildReceiptData(order, pharmacy)
  const { buildReceiptPdfA4 } = await import('./pdf-a4')
  const file = await buildReceiptPdfA4(data)
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> }
  try {
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: `Comprovante ${data.orderNumber ?? ''}`.trim() })
      return true
    }
  } catch { /* usuário cancelou o compartilhamento */ return false }
  // fallback: baixa o PDF + abre o WhatsApp com o texto
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  if (order.customerPhone) {
    window.open(`https://wa.me/${whatsappNumber(order.customerPhone)}?text=${encodeURIComponent(buildReceiptText(data))}`, '_blank')
  }
  return false
}
