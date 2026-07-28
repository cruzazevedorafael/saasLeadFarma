// app/painel/pedidos/_components/pedido-card.tsx
// Cartão de um pedido — extraído de page.tsx pra ser reusado pela lista inicial
// (Server Component) e pelos pedidos que chegam ao vivo via Realtime.
import Link from 'next/link'
import type { OrderWithItems } from '@/lib/data/orders.types'
import type { Pharmacy } from '@/lib/data/pharmacy'
import { PedidoActions } from './pedido-actions'
import { cn } from '@/lib/utils'

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export function PedidoCard({
  order: o,
  pharmacy,
  highlighted = false,
}: {
  order: OrderWithItems
  pharmacy: Pharmacy
  highlighted?: boolean
}) {
  return (
    <div className={cn('space-y-3 rounded-xl border border-border p-4', highlighted && 'order-highlight')}>
      {o.stockWarning && (
        <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-600">
          ⚠️ {o.stockWarning} — entre em contato com o cliente pra combinar.
        </p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold">#{o.number}</span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                o.priceType === 'wholesale' ? 'bg-brand/20 text-brand' : 'bg-muted text-muted-foreground'
              }`}
            >
              {o.priceType === 'wholesale' ? 'Por quantidade' : 'Unitário'}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                o.status === 'pending'
                  ? 'bg-amber-500/15 text-amber-500'
                  : o.status === 'completed'
                    ? 'bg-green-500/15 text-green-600'
                    : 'bg-red-500/15 text-red-500'
              }`}
            >
              {o.status === 'pending' ? 'Pendente' : o.status === 'completed' ? 'Baixado' : 'Cancelado'}
            </span>
          </div>
          <p className="mt-1 text-sm">{o.customerName || 'Sem nome'}</p>
          <a
            href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#25D366] hover:underline"
          >
            {o.customerPhone || 'sem telefone'}
          </a>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-brand">{fmt(o.total)}</p>
          {o.status === 'pending' && <PedidoActions order={o} pharmacy={pharmacy} />}
        </div>
      </div>
      <div className="space-y-1 border-t border-border pt-2">
        {o.items.map((it) => (
          <div key={it.id} className="flex justify-between text-sm text-muted-foreground">
            <span>
              {it.quantity}x {it.productName} ({it.productCode}) — {it.size}/{it.color}
            </span>
            <span className="tabular-nums">{fmt(it.unitPrice * it.quantity)}</span>
          </div>
        ))}
        <div className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{fmt(o.itemsSubtotal || o.total)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Peso total</span>
            <span className="tabular-nums">{(o.weightTotalGrams / 1000).toFixed(3).replace('.', ',')} kg</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Envio</span>
            <span className="tabular-nums">
              {o.shippingLabel || 'A combinar'}
              {o.shippingPrice > 0 ? ` — ${fmt(o.shippingPrice)}` : ''}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Pagamento</span>
            <span className="tabular-nums">
              {o.paymentLabel || 'A combinar'}
              {o.paymentSurcharge > 0 ? ` — +${fmt(o.paymentSurcharge)}` : ''}
            </span>
          </div>
        </div>
      </div>
      <Link href={`/painel/pedidos/${o.id}`} className="inline-block text-sm font-medium text-brand hover:underline">
        Ver itens e fotos →
      </Link>
    </div>
  )
}
