// lib/receipts/pdf-a4.ts — comprovante A4 (jsPDF, roda no navegador).
import { jsPDF } from 'jspdf'
import type { ReceiptData } from './receipt'
import { formatCpf } from '@/lib/cpf'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const kg = (g: number) => `${(g / 1000).toFixed(3).replace('.', ',')} kg`
const ACCENT: [number, number, number] = [249, 115, 22] // #F97316

interface LoadedImage { dataUrl: string; w: number; h: number }

async function loadImage(url: string | null): Promise<LoadedImage | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = reject
      im.src = objUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    URL.revokeObjectURL(objUrl)
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), w: img.naturalWidth, h: img.naturalHeight }
  } catch {
    return null
  }
}

function fit(img: LoadedImage, box: number) {
  const scale = Math.min(box / img.w, box / img.h)
  return { w: img.w * scale, h: img.h * scale }
}

export async function buildReceiptPdfA4(d: ReceiptData): Promise<File> {
  const logo = await loadImage(d.logoUrl || null)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = margin

  // ---- Cabeçalho: farmácia ----
  if (logo) {
    const { w, h } = fit(logo, 22)
    doc.addImage(logo.dataUrl, 'JPEG', margin, y, w, h)
  }
  const tx = logo ? margin + 26 : margin
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20)
  doc.text(d.pharmacyName, tx, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90)
  let hy = y + 11
  const head = [d.pharmacyLegal, d.pharmacyCnpj && `CNPJ: ${d.pharmacyCnpj}`, d.pharmacyAddress,
    d.pharmacyPhone && `Tel: ${d.pharmacyPhone}`, d.pharmacyResponsavel].filter(Boolean) as string[]
  head.forEach((line) => { doc.text(line, tx, hy); hy += 4 })
  doc.setFontSize(10); doc.setTextColor(20); doc.setFont('helvetica', 'bold')
  doc.text(d.orderNumber ? `Pedido #${d.orderNumber}` : 'Comprovante', pageW - margin, y + 5, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(d.date, pageW - margin, y + 10, { align: 'right' })

  y = Math.max(hy, y + 24) + 2
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6); doc.line(margin, y, pageW - margin, y)
  y += 7

  // ---- Cliente ----
  doc.setTextColor(20); doc.setFontSize(11)
  const linha = (label: string, valor: string) => {
    if (!valor) return
    doc.setFont('helvetica', 'bold'); doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(valor, pageW - margin - (margin + 26)) as string[]
    doc.text(lines, margin + 26, y)
    y += 5.5 * lines.length
  }
  linha('Cliente:', d.customerName || '-')
  linha('CPF:', d.customerCpf ? formatCpf(d.customerCpf) : '')
  linha('Telefone:', d.customerPhone)
  linha('Entrega:', d.customerAddress)
  linha('Preço:', d.priceType === 'wholesale' ? 'Por quantidade' : 'Unitário')
  y += 3

  // ---- Itens ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('Itens', margin, y); y += 2.5
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.4); doc.line(margin, y, pageW - margin, y); y += 6

  const nameMaxW = pageW - margin * 2 - 30 // deixa a coluna de valor livre à direita
  d.items.forEach((it, i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5)
    const nameLines = doc.splitTextToSize(`${i + 1}. ${it.name}`, nameMaxW) as string[]
    const attrs = [it.code && `Cód: ${it.code}`, it.presentation && `Apres.: ${it.presentation}`,
      it.dosage && `Dosagem: ${it.dosage}`].filter(Boolean).join('   ')
    const attrLines = attrs ? (doc.splitTextToSize(attrs, nameMaxW) as string[]) : []
    const blockH = nameLines.length * 5 + (attrLines.length ? attrLines.length * 4 + 1 : 0) + 5 + 5

    if (y + blockH > pageH - 55) { doc.addPage(); y = margin }
    const top = y
    let yy = y + 3
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5)
    doc.text(nameLines, margin, yy); yy += nameLines.length * 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
    if (attrLines.length) { doc.text(attrLines, margin, yy); yy += attrLines.length * 4 + 1 }
    doc.text(`${it.quantity} x ${brl(it.unitPrice)}`, margin, yy)
    // valor da linha alinhado à direita, no topo do bloco
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5)
    doc.text(brl(it.unitPrice * it.quantity), pageW - margin, top + 5, { align: 'right' })
    y = yy + 4
    doc.setDrawColor(230); doc.setLineWidth(0.2); doc.line(margin, y - 2, pageW - margin, y - 2)
  })

  // ---- Totais ----
  if (y + 50 > pageH) { doc.addPage(); y = margin }
  y += 4
  doc.setDrawColor(...ACCENT); doc.setLineWidth(0.6); doc.line(margin, y, pageW - margin, y); y += 7
  const total = (label: string, valor: string) => {
    doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    doc.text(label, margin, y); doc.text(valor, pageW - margin, y, { align: 'right' }); y += 5.5
  }
  total('Subtotal', brl(d.subtotal))
  if (d.weightGrams > 0) total('Peso total', kg(d.weightGrams))
  total('Envio', `${d.shippingLabel || 'A combinar'}${d.shippingPrice > 0 ? ` — ${brl(d.shippingPrice)}` : ''}`)
  total('Pagamento', `${d.paymentLabel || 'A combinar'}${d.paymentSurcharge > 0 ? ` — +${brl(d.paymentSurcharge)}` : ''}`)
  y += 2
  doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('TOTAL', margin, y); doc.text(brl(d.total), pageW - margin, y, { align: 'right' })

  // ---- Rodapé ----
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150)
  doc.text('Comprovante emitido pelo LeadFarma', pageW / 2, pageH - 10, { align: 'center' })

  const blob = doc.output('blob')
  return new File([blob], `comprovante-${d.orderNumber ?? 'pedido'}-a4.pdf`, { type: 'application/pdf' })
}
