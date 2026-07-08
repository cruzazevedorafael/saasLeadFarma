// app/painel/clientes/page.tsx — registro de clientes da farmácia (RLS isola por tenant).
import Link from 'next/link'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getCustomers } from '@/lib/data/customers'
import { formatCpf } from '@/lib/cpf'

export default async function ClientesPage() {
  await requirePharmacyAdmin()
  const clientes = await getCustomers()

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-xs text-muted-foreground">
          Cadastros salvos com autorização do cliente (LGPD). {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {clientes.length === 0 ? (
        <p className="text-muted-foreground">Nenhum cliente cadastrado ainda. Os cadastros aparecem quando o cliente finaliza um pedido e autoriza salvar os dados.</p>
      ) : (
        <>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {clientes.map((c) => (
            <Link key={c.id} href={`/painel/clientes/${c.id}`} className="block rounded-xl border border-border p-4 active:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.name}</span>
                <span className="shrink-0 text-xs rounded-full bg-[#F97316]/15 text-[#F97316] px-2 py-0.5">{c.ordersCount} pedido{c.ordersCount !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">{formatCpf(c.cpf)}</p>
              <p className="text-sm text-muted-foreground">{c.phone || 'sem celular'}{(c.cidade || c.uf) ? ` · ${[c.cidade, c.uf].filter(Boolean).join('/')}` : ''}</p>
              <span className="mt-2 inline-block text-sm font-medium text-[#F97316]">Ver histórico →</span>
            </Link>
          ))}
        </div>
        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">CPF</th>
                <th className="p-3">Celular</th>
                <th className="p-3">Cidade/UF</th>
                <th className="p-3">Pedidos</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 font-mono text-xs">{formatCpf(c.cpf)}</td>
                  <td className="p-3">{c.phone || '—'}</td>
                  <td className="p-3">{[c.cidade, c.uf].filter(Boolean).join('/') || '—'}</td>
                  <td className="p-3">{c.ordersCount}</td>
                  <td className="p-3">
                    <Link href={`/painel/clientes/${c.id}`} className="text-[#F97316] hover:underline">Ver histórico</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
