// app/painel/pedidos/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdminOrder } from '@/lib/data/orders'
import { getCurrentPharmacy } from '@/lib/auth/guards'
import { PedidoActions } from '../_components/pedido-actions'
import { ComprovanteActions } from '../_components/comprovante-actions'
import { formatCpf } from '@/lib/cpf'

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const dataHora = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR') : null)

export default async function PedidoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const pharmacy = await getCurrentPharmacy()

  const { id } = await params
  const o = await getAdminOrder(id, pharmacy.id)
  if (!o) notFound()

  const statusLabel = o.status === 'pending' ? 'Pendente' : o.status === 'completed' ? 'Baixado' : 'Cancelado'
  const statusClass =
    o.status === 'pending' ? 'bg-amber-500/15 text-amber-500'
    : o.status === 'completed' ? 'bg-green-500/15 text-green-600'
    : 'bg-red-500/15 text-red-500'

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-5">
      <div>
        <Link href="/painel/pedidos" className="text-sm text-muted-foreground hover:underline">← Pedidos</Link>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="text-2xl font-bold">Pedido #{o.number}</h1>
          <span className={`text-xs px-2 py-0.5 rounded ${statusClass}`}>{statusLabel}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${o.priceType === 'wholesale' ? 'bg-brand/20 text-brand' : 'bg-muted text-muted-foreground'}`}>
            {o.priceType === 'wholesale' ? 'Por quantidade' : 'Unitário'}
          </span>
        </div>
      </div>

      {o.stockWarning && (
        <p className="rounded-lg bg-amber-500/15 text-amber-600 text-sm font-medium px-3 py-2">
          ⚠️ {o.stockWarning} — entre em contato com o cliente pra combinar.
        </p>
      )}

      {/* Cliente */}
      <div className="rounded-xl border border-border p-4 space-y-1">
        <h2 className="font-semibold text-sm mb-1">Cliente</h2>
        <p className="text-sm">{o.customerName || 'Sem nome'}</p>
        {o.customerCpf && <p className="text-xs text-muted-foreground font-mono">CPF: {formatCpf(o.customerCpf)}</p>}
        <a
          href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`}
          target="_blank" rel="noopener noreferrer"
          className="text-sm text-[#25D366] hover:underline"
        >{o.customerPhone || 'sem telefone'}</a>
        {(o.customerLogradouro || o.customerCidade) && (
          <p className="text-sm pt-1">
            <span className="text-muted-foreground">Entrega: </span>
            {[
              o.customerLogradouro && `${o.customerLogradouro}${o.customerNumero ? `, ${o.customerNumero}` : ''}`,
              o.customerComplemento, o.customerBairro,
              (o.customerCidade || o.customerUf) && `${o.customerCidade}${o.customerUf ? `/${o.customerUf}` : ''}`,
              o.customerCep && `CEP ${o.customerCep}`,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
          <p>Criado em {dataHora(o.createdAt)}</p>
          {o.completedAt && <p>Baixado em {dataHora(o.completedAt)}</p>}
          {o.cancelledAt && <p>Cancelado em {dataHora(o.cancelledAt)}</p>}
        </div>
      </div>

      {/* Itens */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm">Itens ({o.items.length})</h2>
        {o.items.map((it) => (
          <div key={it.id} className="flex gap-3 rounded-xl border border-border p-3">
            <img
              src={it.imageUrl ?? '/placeholder.svg'}
              alt={it.productName}
              className="h-20 w-20 rounded-lg object-cover shrink-0 bg-muted"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{it.productName || 'Produto'}</p>
              {it.productCode && <p className="text-xs text-muted-foreground">Código: {it.productCode}</p>}
              <div className="flex gap-2 mt-1 flex-wrap">
                {it.size && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Apres.: {it.size}</span>}
                {it.color && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Dosagem: {it.color}</span>}
              </div>
              <p className="text-sm mt-1 text-muted-foreground">{it.quantity} x {fmt(it.unitPrice)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-brand">{fmt(it.unitPrice * it.quantity)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Totais */}
      <div className="rounded-xl border border-border p-4 text-sm space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span><span>{fmt(o.itemsSubtotal || o.total)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Peso total</span><span>{(o.weightTotalGrams / 1000).toFixed(3).replace('.', ',')} kg</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Envio</span><span>{o.shippingLabel || 'A combinar'}{o.shippingPrice > 0 ? ` — ${fmt(o.shippingPrice)}` : ''}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Pagamento</span><span>{o.paymentLabel || 'A combinar'}{o.paymentSurcharge > 0 ? ` — +${fmt(o.paymentSurcharge)}` : ''}</span>
        </div>
        <div className="flex justify-between font-bold text-base pt-2 border-t border-border mt-1">
          <span>Total</span><span className="text-brand">{fmt(o.total)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h2 className="font-semibold text-sm mb-2">Comprovante</h2>
        <ComprovanteActions order={o} pharmacy={pharmacy} />
      </div>

      {o.status === 'pending' && (
        <div className="rounded-xl border border-border p-4">
          <h2 className="font-semibold text-sm mb-2">Ações</h2>
          <PedidoActions orderId={o.id} />
        </div>
      )}
    </div>
  )
}
