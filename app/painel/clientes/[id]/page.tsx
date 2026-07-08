// app/painel/clientes/[id]/page.tsx — cadastro atual + histórico versionado.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getCustomer, getCustomerHistory, type CustomerAddress } from '@/lib/data/customers'
import { formatCpf } from '@/lib/cpf'

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
  const historico = await getCustomerHistory(id)

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
