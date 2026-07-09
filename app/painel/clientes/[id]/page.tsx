// app/painel/clientes/[id]/page.tsx — cadastro atual + histórico versionado.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getCustomer, getCustomerHistory, getCustomerOrders, type CustomerAddress } from '@/lib/data/customers'
import { formatCpf } from '@/lib/cpf'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const statusLabel: Record<string, string> = { pending: 'Pendente', completed: 'Baixado', cancelled: 'Cancelado' }

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
  const [historico, pedidos] = await Promise.all([getCustomerHistory(id), getCustomerOrders(id)])

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-2xl">
      <div>
        <Link href="/painel/clientes" className="text-sm text-muted-foreground hover:underline">← Clientes</Link>
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
        <h2 className="font-semibold text-sm">Histórico de pedidos ({pedidos.length})</h2>
        {pedidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {pedidos.map((p) => (
              <li key={p.id}>
                <Link href={`/painel/pedidos/${p.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">#{p.number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'pending' ? 'bg-amber-500/15 text-amber-600' : p.status === 'completed' ? 'bg-green-500/15 text-green-600' : 'bg-red-500/15 text-red-500'}`}>{statusLabel[p.status]}</span>
                    <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                  </span>
                  <span className="font-semibold text-brand">{brl(p.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
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
