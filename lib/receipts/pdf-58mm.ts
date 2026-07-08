// lib/receipts/pdf-58mm.ts — comprovante para impressora térmica 58mm (jsPDF).
// Largura fixa 58mm, altura calculada pelo conteúdo, fonte monoespaçada.
import { jsPDF } from 'jspdf'
import type { ReceiptData } from './receipt'
import { formatCpf } from '@/lib/cpf'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

const WIDTH = 58
const MARGIN = 4
const CONTENT = WIDTH - MARGIN * 2 // ~50mm
const CHARS = 32                   // caracteres por linha (courier ~8pt)
const LINE = 3.4                   // mm por linha

type Line = { t: string; bold?: boolean; center?: boolean; sep?: boolean }

// Quebra texto em linhas de no máximo CHARS caracteres (palavra inteira).
function wrap(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split('\n')) {
    let line = ''
    for (const word of raw.split(' ')) {
      if ((line + (line ? ' ' : '') + word).length > CHARS) {
        if (line) out.push(line)
        line = word.length > CHARS ? word.slice(0, CHARS) : word
      } else {
        line += (line ? ' ' : '') + word
      }
    }
    out.push(line)
  }
  return out
}

// Linha "esquerda ............ direita" ocupando CHARS colunas.
function lr(left: string, right: string): string {
  const space = Math.max(1, CHARS - left.length - right.length)
  return left + ' '.repeat(space) + right
}

function buildLines(d: ReceiptData): Line[] {
  const L: Line[] = []
  const push = (t: string, opt: Partial<Line> = {}) => wrap(t).forEach((w) => L.push({ t: w, ...opt }))
  const sep = () => L.push({ t: '', sep: true })

  push(d.pharmacyName.toUpperCase(), { bold: true, center: true })
  if (d.pharmacyLegal) push(d.pharmacyLegal, { center: true })
  if (d.pharmacyCnpj) push(`CNPJ ${d.pharmacyCnpj}`, { center: true })
  if (d.pharmacyAddress) push(d.pharmacyAddress, { center: true })
  if (d.pharmacyPhone) push(`Tel ${d.pharmacyPhone}`, { center: true })
  if (d.pharmacyResponsavel) push(d.pharmacyResponsavel, { center: true })
  sep()
  push(`COMPROVANTE${d.orderNumber ? ` #${d.orderNumber}` : ''}`, { bold: true, center: true })
  push(d.date, { center: true })
  push(`Preco: ${d.priceType === 'wholesale' ? 'Por quantidade' : 'Unitario'}`)
  sep()
  push('CLIENTE', { bold: true })
  push(d.customerName || '-')
  if (d.customerCpf) push(`CPF ${formatCpf(d.customerCpf)}`)
  if (d.customerPhone) push(`Tel ${d.customerPhone}`)
  if (d.customerAddress) push(`Entrega: ${d.customerAddress}`)
  sep()
  push('ITENS', { bold: true })
  d.items.forEach((it, i) => {
    push(`${i + 1}. ${it.name}`, { bold: true })
    const attrs = [it.code, it.presentation, it.dosage].filter(Boolean).join(' / ')
    if (attrs) push(attrs)
    L.push({ t: lr(`${it.quantity} x ${brl(it.unitPrice)}`, brl(it.unitPrice * it.quantity)) })
  })
  sep()
  L.push({ t: lr('Subtotal', brl(d.subtotal)) })
  L.push({ t: lr('Envio', d.shippingPrice > 0 ? brl(d.shippingPrice) : (d.shippingLabel || 'A combinar')) })
  L.push({ t: lr('Pagamento', d.paymentSurcharge > 0 ? `+${brl(d.paymentSurcharge)}` : (d.paymentLabel || '-')) })
  L.push({ t: lr('TOTAL', brl(d.total)), bold: true })
  sep()
  push('Emitido por LeadFarma', { center: true })
  return L
}

export function buildReceiptPdf58mm(d: ReceiptData): File {
  const lines = buildLines(d)
  const height = MARGIN * 2 + lines.length * LINE + 4
  const doc = new jsPDF({ unit: 'mm', format: [WIDTH, height] })
  doc.setFont('courier', 'normal')
  doc.setTextColor(0)
  let y = MARGIN + 2
  for (const ln of lines) {
    if (ln.sep) {
      doc.setDrawColor(120); doc.setLineWidth(0.15)
      doc.line(MARGIN, y - LINE / 2, WIDTH - MARGIN, y - LINE / 2)
      y += LINE * 0.4
      continue
    }
    doc.setFont('courier', ln.bold ? 'bold' : 'normal')
    doc.setFontSize(8)
    if (ln.center) doc.text(ln.t, WIDTH / 2, y, { align: 'center' })
    else doc.text(ln.t, MARGIN, y)
    y += LINE
  }
  const blob = doc.output('blob')
  return new File([blob], `comprovante-${d.orderNumber ?? 'pedido'}-58mm.pdf`, { type: 'application/pdf' })
}
