// lib/receipts/receipt.ts — dados e texto do comprovante (puro, testável).
// Os geradores de PDF (A4 e 58mm) consomem ReceiptData montado aqui.
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { formatCpf } from '@/lib/cpf'

export interface ReceiptItem {
  name: string
  code: string
  presentation: string
  dosage: string
  quantity: number
  unitPrice: number
  imageUrl?: string | null
}

export interface ReceiptData {
  pharmacyName: string
  pharmacyLegal: string      // razão social / nome fantasia
  pharmacyCnpj: string
  pharmacyAddress: string
  pharmacyPhone: string
  pharmacyResponsavel: string // "Farm. Fulano — CRF X"
  logoUrl: string
  orderNumber: number | null
  date: string
  priceType: 'wholesale' | 'retail'
  customerName: string
  customerCpf: string
  customerPhone: string
  customerAddress: string
  items: ReceiptItem[]
  subtotal: number
  weightGrams: number
  shippingLabel: string
  shippingPrice: number
  paymentLabel: string
  paymentSurcharge: number
  total: number
}

const joinParts = (parts: (string | null | undefined | false)[], sep = ' · ') =>
  parts.filter(Boolean).join(sep)

export function pharmacyAddress(p: Pharmacy): string {
  return joinParts([
    p.logradouro && `${p.logradouro}${p.numero ? `, ${p.numero}` : ''}`,
    p.bairro,
    (p.cidade || p.uf) && `${p.cidade ?? ''}${p.uf ? `/${p.uf}` : ''}`,
    p.cep && `CEP ${p.cep}`,
  ])
}

export function customerAddress(o: OrderWithItems): string {
  return joinParts([
    o.customerLogradouro && `${o.customerLogradouro}${o.customerNumero ? `, ${o.customerNumero}` : ''}`,
    o.customerComplemento,
    o.customerBairro,
    (o.customerCidade || o.customerUf) && `${o.customerCidade}${o.customerUf ? `/${o.customerUf}` : ''}`,
    o.customerCep && `CEP ${o.customerCep}`,
  ])
}

export function buildReceiptData(o: OrderWithItems, p: Pharmacy): ReceiptData {
  const responsavel = joinParts([
    p.farmaceuticoResponsavel && `Farm. ${p.farmaceuticoResponsavel}`,
    p.crf && `CRF ${p.crf}`,
  ], ' — ')
  return {
    pharmacyName: p.nomeExibicao || p.nomeFantasia || 'Farmácia',
    pharmacyLegal: p.razaoSocial || p.nomeFantasia || '',
    pharmacyCnpj: p.cnpj || '',
    pharmacyAddress: pharmacyAddress(p),
    pharmacyPhone: p.telefone || p.whatsappNumber || '',
    pharmacyResponsavel: responsavel,
    logoUrl: p.logoUrl || '',
    orderNumber: o.number,
    date: new Date(o.createdAt).toLocaleString('pt-BR'),
    priceType: o.priceType,
    customerName: o.customerName,
    customerCpf: o.customerCpf,
    customerPhone: o.customerPhone,
    customerAddress: customerAddress(o),
    items: o.items.map((it) => ({
      name: it.productName, code: it.productCode,
      presentation: it.size, dosage: it.color,
      quantity: it.quantity, unitPrice: it.unitPrice, imageUrl: it.imageUrl,
    })),
    subtotal: o.itemsSubtotal || o.total,
    weightGrams: o.weightTotalGrams,
    shippingLabel: o.shippingLabel,
    shippingPrice: o.shippingPrice,
    paymentLabel: o.paymentLabel,
    paymentSurcharge: o.paymentSurcharge,
    total: o.total,
  }
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

// Comprovante em TEXTO organizado (para enviar no WhatsApp / copiar).
// Estrutura limpa: cabeçalho da farmácia, dados do pedido, cliente, itens, totais.
export function buildReceiptText(d: ReceiptData): string {
  const L: string[] = []
  const linha = '──────────────────────'

  // Cabeçalho da farmácia
  L.push(`*${d.pharmacyName.toUpperCase()}*`)
  if (d.pharmacyLegal) L.push(d.pharmacyLegal)
  if (d.pharmacyCnpj) L.push(`CNPJ ${d.pharmacyCnpj}`)
  if (d.pharmacyAddress) L.push(d.pharmacyAddress)
  if (d.pharmacyPhone) L.push(`Tel ${d.pharmacyPhone}`)
  if (d.pharmacyResponsavel) L.push(d.pharmacyResponsavel)

  // Cabeçalho do comprovante
  L.push(linha)
  L.push(`*COMPROVANTE${d.orderNumber ? ` Nº ${d.orderNumber}` : ''}*`)
  L.push(`🗓️ ${d.date}`)
  L.push(`Preço: ${d.priceType === 'wholesale' ? 'Por quantidade' : 'Unitário'}`)

  // Cliente
  L.push(linha)
  L.push('*CLIENTE*')
  L.push(d.customerName || '—')
  if (d.customerCpf) L.push(`CPF ${formatCpf(d.customerCpf)}`)
  if (d.customerPhone) L.push(`Contato ${d.customerPhone}`)
  if (d.customerAddress) L.push(`📍 ${d.customerAddress}`)

  // Itens
  L.push(linha)
  L.push('*ITENS*')
  d.items.forEach((it, i) => {
    const attrs = joinParts([it.presentation, it.dosage], ' · ')
    L.push(`${i + 1}. *${it.name}*${attrs ? ` — ${attrs}` : ''}`)
    L.push(`   ${it.quantity} × ${brl(it.unitPrice)}  =  *${brl(it.unitPrice * it.quantity)}*`)
  })

  // Totais
  L.push(linha)
  L.push(`Subtotal: ${brl(d.subtotal)}`)
  L.push(`Envio: ${d.shippingPrice > 0 ? brl(d.shippingPrice) : (d.shippingLabel || 'A combinar')}`)
  L.push(`Pagamento: ${d.paymentLabel || 'A combinar'}${d.paymentSurcharge > 0 ? ` (+${brl(d.paymentSurcharge)})` : ''}`)
  L.push(`*TOTAL: ${brl(d.total)}*`)
  L.push(linha)
  L.push('_Emitido por LeadFarma_')
  return L.join('\n')
}
