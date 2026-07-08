// lib/receipts/html.ts — comprovante em HTML limpo (para imprimir).
// Estrutura organizada: cabeçalho da farmácia → dados do pedido/cliente → itens
// → totais → rodapé. Minimalista, preto no branco, pronto pra impressão A4.
import type { ReceiptData } from './receipt'
import { formatCpf } from '@/lib/cpf'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const esc = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildReceiptHtml(d: ReceiptData): string {
  const linhaCab = [d.pharmacyLegal, d.pharmacyCnpj && `CNPJ ${d.pharmacyCnpj}`, d.pharmacyAddress,
    d.pharmacyPhone && `Tel ${d.pharmacyPhone}`, d.pharmacyResponsavel]
    .filter(Boolean).map((l) => `<div>${esc(l as string)}</div>`).join('')

  const itens = d.items.map((it, i) => {
    const attrs = [it.code && `Cód ${it.code}`, it.presentation, it.dosage].filter(Boolean).join(' · ')
    return `<tr>
      <td class="i-nome">
        <div class="b">${i + 1}. ${esc(it.name)}</div>
        ${attrs ? `<div class="i-attr">${esc(attrs)}</div>` : ''}
      </td>
      <td class="i-num">${it.quantity}×</td>
      <td class="i-num">${brl(it.unitPrice)}</td>
      <td class="i-num b">${brl(it.unitPrice * it.quantity)}</td>
    </tr>`
  }).join('')

  const endereco = d.customerAddress ? `<div><span class="mut">Entrega:</span> ${esc(d.customerAddress)}</div>` : ''
  const cpf = d.customerCpf ? `<div><span class="mut">CPF:</span> ${formatCpf(d.customerCpf)}</div>` : ''

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comprovante ${d.orderNumber ? '#' + d.orderNumber : ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 24px; }
  .doc { max-width: 640px; margin: 0 auto; }
  .hdr { text-align: center; }
  .hdr .nome { font-size: 20px; font-weight: 700; letter-spacing: .2px; }
  .hdr div { font-size: 12px; color: #555; line-height: 1.45; }
  .rule { border: none; border-top: 1.5px solid #F97316; margin: 14px 0; }
  .rule.thin { border-top: 1px solid #e5e5e5; }
  .meta { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
  .meta .tit { font-weight: 700; font-size: 15px; }
  .sec-tit { font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: #F97316; font-weight: 700; margin: 14px 0 6px; }
  .cli div { font-size: 13px; line-height: 1.6; }
  .mut { color: #777; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: .5px; padding: 4px 6px; border-bottom: 1px solid #e5e5e5; }
  td { padding: 7px 6px; font-size: 13px; vertical-align: top; border-bottom: 1px solid #f0f0f0; }
  .i-num { text-align: right; white-space: nowrap; }
  .i-attr { font-size: 11px; color: #777; margin-top: 2px; }
  .b { font-weight: 700; }
  .tot { margin-top: 10px; margin-left: auto; width: 60%; font-size: 13px; }
  .tot .row { display: flex; justify-content: space-between; padding: 3px 0; color: #555; }
  .tot .grand { display: flex; justify-content: space-between; padding: 8px 0 0; margin-top: 6px; border-top: 1.5px solid #111; font-size: 17px; font-weight: 700; color: #111; }
  .ft { text-align: center; font-size: 11px; color: #999; margin-top: 22px; }
  .ft b { color: #F97316; }
  @media print { body { padding: 0; } .doc { max-width: 100%; } @page { margin: 14mm; } }
</style></head>
<body><div class="doc">
  <div class="hdr">
    <div class="nome">${esc(d.pharmacyName)}</div>
    ${linhaCab}
  </div>
  <hr class="rule">
  <div class="meta">
    <span class="tit">Comprovante${d.orderNumber ? ' Nº ' + d.orderNumber : ''}</span>
    <span class="mut">${esc(d.date)}</span>
  </div>
  <div class="mut" style="font-size:12px">Preço: ${d.priceType === 'wholesale' ? 'Por quantidade' : 'Unitário'}</div>

  <div class="sec-tit">Cliente</div>
  <div class="cli">
    <div class="b">${esc(d.customerName) || '—'}</div>
    ${cpf}
    ${d.customerPhone ? `<div><span class="mut">Contato:</span> ${esc(d.customerPhone)}</div>` : ''}
    ${endereco}
  </div>

  <div class="sec-tit">Itens</div>
  <table>
    <thead><tr><th>Produto</th><th class="i-num">Qtd</th><th class="i-num">Unit.</th><th class="i-num">Total</th></tr></thead>
    <tbody>${itens}</tbody>
  </table>

  <div class="tot">
    <div class="row"><span>Subtotal</span><span>${brl(d.subtotal)}</span></div>
    <div class="row"><span>Envio</span><span>${d.shippingPrice > 0 ? brl(d.shippingPrice) : esc(d.shippingLabel || 'A combinar')}</span></div>
    <div class="row"><span>Pagamento</span><span>${esc(d.paymentLabel || 'A combinar')}${d.paymentSurcharge > 0 ? ' (+' + brl(d.paymentSurcharge) + ')' : ''}</span></div>
    <div class="grand"><span>Total</span><span>${brl(d.total)}</span></div>
  </div>

  <div class="ft">Comprovante emitido por <b>LeadFarma</b></div>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
</body></html>`
}
