// Monta o PDF do pedido (logomarca + fotos dos produtos + itens + totais).
// Roda no navegador (usa canvas/Image). Retorna um File pronto pra compartilhar.
import { jsPDF } from 'jspdf'

export interface OrderPdfItem {
  name: string
  code: string
  size: string
  color: string
  quantity: number
  unitPrice: number
  imageUrl: string | null
}

export interface OrderPdfData {
  storeName: string
  logoUrl: string
  orderNumber: number | null
  date: string
  customerName: string
  customerPhone: string
  priceType: 'wholesale' | 'retail'
  items: OrderPdfItem[]
  subtotal: number
  weightGrams: number
  shippingLabel: string
  paymentLabel: string
  total: number
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const kg = (g: number) => `${(g / 1000).toFixed(3).replace('.', ',')} kg`
const ACCENT: [number, number, number] = [124, 158, 0] // verde da marca, legível no branco

interface LoadedImage {
  dataUrl: string
  w: number
  h: number
}

// Baixa a imagem, normaliza para JPEG via canvas (evita problemas de formato/CORS
// no jsPDF). Se falhar, devolve null e o PDF é gerado sem aquela foto.
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

// Encaixa a imagem numa caixa (mm) mantendo a proporção.
function fit(img: LoadedImage, box: number) {
  const scale = Math.min(box / img.w, box / img.h)
  return { w: img.w * scale, h: img.h * scale }
}

export async function buildOrderPdf(data: OrderPdfData): Promise<File> {
  const [logo, itemImages] = await Promise.all([
    loadImage(data.logoUrl),
    Promise.all(data.items.map((it) => loadImage(it.imageUrl))),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = margin

  // ---- Cabeçalho ----
  if (logo) {
    const { w, h } = fit(logo, 22)
    doc.addImage(logo.dataUrl, 'JPEG', margin, y, w, h)
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(data.storeName || 'LeadFarma', margin + 26, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(data.orderNumber ? `Pedido #${data.orderNumber}` : 'Pedido', pageW - margin, y + 6, { align: 'right' })
  doc.text(data.date, pageW - margin, y + 11, { align: 'right' })
  y += 26
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ---- Cliente ----
  doc.setFontSize(11)
  const linhaCliente = (label: string, valor: string) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(valor || '-', margin + 24, y)
    y += 6
  }
  linhaCliente('Cliente:', data.customerName)
  linhaCliente('Telefone:', data.customerPhone)
  linhaCliente('Preço:', data.priceType === 'wholesale' ? 'ATACADO' : 'VAREJO')
  y += 4

  // ---- Itens ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Itens do pedido', margin, y)
  y += 3
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  const rowH = 22
  const box = 18
  data.items.forEach((it, i) => {
    if (y + rowH > pageH - 55) {
      doc.addPage()
      y = margin
    }
    const img = itemImages[i]
    if (img) {
      const { w, h } = fit(img, box)
      doc.addImage(img.dataUrl, 'JPEG', margin, y, w, h)
    } else {
      doc.setDrawColor(210)
      doc.setLineWidth(0.2)
      doc.rect(margin, y, box, box)
    }
    const tx = margin + box + 4
    doc.setTextColor(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`${i + 1}. ${it.name}`, tx, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(80)
    let ty = y + 9
    if (it.code) {
      doc.text(`Código: ${it.code}`, tx, ty)
      ty += 4.5
    }
    doc.text(`Tam: ${it.size || '-'}    Cor: ${it.color || '-'}`, tx, ty)
    ty += 4.5
    doc.text(`${it.quantity} x ${brl(it.unitPrice)}`, tx, ty)
    doc.setTextColor(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(brl(it.unitPrice * it.quantity), pageW - margin, y + 11, { align: 'right' })
    y += rowH
    doc.setDrawColor(228)
    doc.setLineWidth(0.2)
    doc.line(margin, y - 3, pageW - margin, y - 3)
  })

  // ---- Totais ----
  if (y + 50 > pageH) {
    doc.addPage()
    y = margin
  }
  y += 4
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageW - margin, y)
  y += 7

  const linhaTotal = (label: string, valor: string) => {
    doc.setTextColor(80)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.text(label, margin, y)
    doc.text(valor, pageW - margin, y, { align: 'right' })
    y += 6
  }
  linhaTotal('Subtotal', brl(data.subtotal))
  linhaTotal('Peso total', kg(data.weightGrams))
  linhaTotal('Envio', data.shippingLabel)
  linhaTotal('Pagamento', data.paymentLabel)
  y += 2
  doc.setTextColor(20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('TOTAL', margin, y)
  doc.text(brl(data.total), pageW - margin, y, { align: 'right' })

  // ---- Rodapé ----
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text('Pedido gerado pelo catalogo LeadFarma', pageW / 2, pageH - 10, { align: 'center' })

  const blob = doc.output('blob')
  const filename = `pedido-${data.orderNumber ?? 'pedido'}.pdf`
  return new File([blob], filename, { type: 'application/pdf' })
}
