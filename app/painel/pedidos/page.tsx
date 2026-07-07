// app/painel/pedidos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminOrders } from '@/lib/data/orders'
import type { OrderStatus } from '@/lib/data/orders.types'
import { PedidoActions } from './_components/pedido-actions'

const FILTROS: { key: string; label: string; status?: OrderStatus }[] = [
  { key: 'pending', label: 'Pendentes', status: 'pending' },
  { key: 'completed', label: 'Baixados', status: 'completed' },
  { key: 'cancelled', label: 'Cancelados', status: 'cancelled' },
  { key: 'all', label: 'Todos' },
]

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { f = 'pending' } = await searchParams
  const filtro = FILTROS.find((x) => x.key === f) ?? FILTROS[0]
  const pedidos = await getAdminOrders(filtro.status)

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
          <h1 className="text-2xl font-bold">Pedidos</h1>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((x) => (
          <Link
            key={x.key}
            href={`/painel/pedidos?f=${x.key}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              x.key === filtro.key ? 'bg-[#F97316] text-black' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {pedidos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido nesta lista.</p>
      ) : (
        <div className="space-y-3">
          {pedidos.map((o) => (
            <div key={o.id} className="rounded-xl border border-border p-4 space-y-3">
              {o.stockWarning && (
                <p className="rounded-lg bg-amber-500/15 text-amber-600 text-sm font-medium px-3 py-2">
                  ⚠️ {o.stockWarning} — entre em contato com o cliente pra combinar.
                </p>
              )}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{o.number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      o.priceType === 'wholesale' ? 'bg-[#F97316]/20 text-[#9bbf00]' : 'bg-muted text-muted-foreground'
                    }`}>{o.priceType === 'wholesale' ? 'Atacado' : 'Varejo'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      o.status === 'pending' ? 'bg-amber-500/15 text-amber-500'
                      : o.status === 'completed' ? 'bg-green-500/15 text-green-600'
                      : 'bg-red-500/15 text-red-500'
                    }`}>{o.status === 'pending' ? 'Pendente' : o.status === 'completed' ? 'Baixado' : 'Cancelado'}</span>
                  </div>
                  <p className="text-sm mt-1">{o.customerName || 'Sem nome'}</p>
                  <a
                    href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm text-[#25D366] hover:underline"
                  >{o.customerPhone || 'sem telefone'}</a>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#9bbf00]">{fmt(o.total)}</p>
                  {o.status === 'pending' && <PedidoActions orderId={o.id} />}
                </div>
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                {o.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm text-muted-foreground">
                    <span>{it.quantity}x {it.productName} ({it.productCode}) — {it.size}/{it.color}</span>
                    <span>{fmt(it.unitPrice * it.quantity)}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-border/60 text-sm space-y-0.5">
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
                </div>
              </div>
              <Link href={`/painel/pedidos/${o.id}`} className="inline-block text-sm font-medium text-[#9bbf00] hover:underline">
                Ver itens e fotos →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
