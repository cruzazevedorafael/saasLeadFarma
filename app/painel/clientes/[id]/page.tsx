// app/painel/clientes/[id]/page.tsx — cadastro atual + histórico versionado.
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { notFound } from 'next/navigation'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getCustomer, getCustomerHistory, getCustomerOrdersDetailed, type CustomerAddress, type DetailedCustomerOrder } from '@/lib/data/customers'
import { formatCpf } from '@/lib/cpf'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const dataHora = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR') : null)
const statusLabel: Record<string, string> = { pending: 'Pendente', completed: 'Baixado', cancelled: 'Cancelado' }
const statusClass: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600', completed: 'bg-green-500/15 text-green-600', cancelled: 'bg-red-500/15 text-red-500',
}

function endereco(a: CustomerAddress): string {
  const parts = [
    a.logradouro && `${a.logradouro}${a.numero ? `, ${a.numero}` : ''}`,
    a.complemento, a.bairro,
    (a.cidade || a.uf) && `${a.cidade}${a.uf ? `/${a.uf}` : ''}`,
    a.cep && `CEP ${a.cep}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePharmacyAdmin()
  const { id } = await params
  const cliente = await getCustomer(id)
  if (!cliente) notFound()
  const [historico, pedidos] = await Promise.all([getCustomerHistory(id), getCustomerOrdersDetailed(id)])

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-2xl">
      <div>
        <BackButton href="/painel/clientes" label="Clientes" />
        <h1 className="text-2xl font-bold">{cliente.name}</h1>
        <p className="text-xs text-muted-foreground font-mono">{formatCpf(cliente.cpf)}</p>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-1.5">
        <h2 className="font-semibold text-sm">Cadastro atual</h2>
        <p className="text-sm"><span className="text-muted-foreground">Celular:</span> {cliente.phone || '—'}</p>
        <p className="text-sm"><span className="text-muted-foreground">Endereço:</span> {endereco(cliente)}</p>
        <p className="text-sm"><span className="text-muted-foreground">Pedidos:</span> {cliente.ordersCount}</p>
        <p className="text-xs text-muted-foreground pt-1">
          {cliente.lgpdConsent ? '✓ Autorizou o uso dos dados (LGPD)' : 'Sem autorização registrada'}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Registro detalhado de vendas ({pedidos.length})</h2>
          <p className="text-xs text-muted-foreground">Cada venda com os dados exatos usados no momento da compra — registro para comprovação.</p>
        </div>
        {pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {pedidos.map((p) => <PedidoRegistro key={p.id} p={p} />)}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Histórico de cadastros anteriores</h2>
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteração registrada — este é o primeiro cadastro.</p>
        ) : (
          <ul className="space-y-2">
            {historico.map((h) => (
              <li key={h.id} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                <div className="text-xs text-muted-foreground mb-1">
                  {new Date(h.createdAt).toLocaleString('pt-BR')}
                </div>
                <div>{h.name} · {h.phone || 'sem celular'}</div>
                <div className="text-muted-foreground">{endereco(h)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PedidoRegistro({ p }: { p: DetailedCustomerOrder }) {
  const end = [
    p.snapLogradouro && `${p.snapLogradouro}${p.snapNumero ? `, ${p.snapNumero}` : ''}`,
    p.snapComplemento, p.snapBairro,
    (p.snapCidade || p.snapUf) && `${p.snapCidade}${p.snapUf ? `/${p.snapUf}` : ''}`,
    p.snapCep && `CEP ${p.snapCep}`,
  ].filter(Boolean).join(' · ') || '—'

  return (
    <details className="group rounded-xl border border-border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3.5">
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">#{p.number}</span>
          <span className={`rounded px-2 py-0.5 text-xs ${statusClass[p.status]}`}>{statusLabel[p.status]}</span>
          <span className="text-muted-foreground">{dataHora(p.createdAt)}</span>
        </span>
        <span className="shrink-0 font-semibold text-brand tabular-nums">{brl(p.total)}</span>
      </summary>

      <div className="space-y-3 border-t border-border px-3.5 py-3 text-sm">
        {/* snapshot cadastral no momento da compra */}
        <div className="rounded-lg bg-muted/40 p-3 space-y-0.5 text-xs">
          <p className="font-medium text-foreground text-sm">Dados usados nesta compra</p>
          <p><span className="text-muted-foreground">Cliente:</span> {p.snapName || '—'}</p>
          <p><span className="text-muted-foreground">CPF:</span> <span className="font-mono">{p.snapCpf ? formatCpf(p.snapCpf) : '—'}</span></p>
          <p><span className="text-muted-foreground">Celular:</span> {p.snapPhone || '—'}</p>
          <p><span className="text-muted-foreground">Endereço:</span> {end}</p>
        </div>

        {/* itens */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Itens</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1 font-medium">Cód.</th><th className="py-1 font-medium">Produto</th><th className="py-1 font-medium text-right">Qtd</th><th className="py-1 font-medium text-right">Unit.</th><th className="py-1 font-medium text-right">Total</th></tr>
              </thead>
              <tbody>
                {p.items.map((it, k) => (
                  <tr key={k} className="border-t border-border/60">
                    <td className="py-1 font-mono">{it.code || '—'}</td>
                    <td className="py-1">{it.name}{(it.size || it.color) ? <span className="text-muted-foreground"> ({[it.size, it.color].filter(Boolean).join('/')})</span> : null}</td>
                    <td className="py-1 text-right tabular-nums">{it.quantity}</td>
                    <td className="py-1 text-right tabular-nums">{brl(it.unitPrice)}</td>
                    <td className="py-1 text-right tabular-nums">{brl(it.unitPrice * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* valores e entrega/pagamento */}
        <div className="grid gap-1 text-xs sm:grid-cols-2">
          <p><span className="text-muted-foreground">Subtotal:</span> {brl(p.itemsSubtotal)}</p>
          <p><span className="text-muted-foreground">Preço:</span> {p.priceType === 'wholesale' ? 'por quantidade' : 'unitário'}</p>
          <p><span className="text-muted-foreground">Entrega:</span> {p.shippingLabel || '—'} {p.shippingPrice ? `(${brl(p.shippingPrice)})` : ''}</p>
          <p><span className="text-muted-foreground">Pagamento:</span> {p.paymentLabel || '—'} {p.paymentSurcharge ? `(+${brl(p.paymentSurcharge)})` : ''}</p>
          {p.completedAt && <p><span className="text-muted-foreground">Baixado em:</span> {dataHora(p.completedAt)}</p>}
          {p.cancelledAt && <p><span className="text-muted-foreground">Cancelado em:</span> {dataHora(p.cancelledAt)}</p>}
          <p className="font-semibold"><span className="text-muted-foreground font-normal">Total:</span> {brl(p.total)}</p>
        </div>

        <Link href={`/painel/pedidos/${p.id}`} className="inline-block text-xs font-medium text-brand hover:underline">Abrir pedido completo →</Link>
      </div>
    </details>
  )
}
