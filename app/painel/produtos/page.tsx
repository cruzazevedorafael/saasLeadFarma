// app/painel/produtos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAdminProducts } from '@/lib/data/products'
import { Button } from '@/components/ui/button'
import { ProdutoActions } from './_components/produto-actions'

export default async function ProdutosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const produtos = await getAdminProducts()
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
          <h1 className="text-2xl font-bold">Produtos</h1>
        </div>
        <Link href="/painel/produtos/novo"><Button>Novo produto</Button></Link>
      </div>

      {produtos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
      ) : (
        <>
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Foto</th>
                <th className="p-3">Código</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Atacado</th>
                <th className="p-3">Varejo</th>
                <th className="p-3">Estoque</th>
                <th className="p-3">Conta atacado</th>
                <th className="p-3">Ativo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">
                    <img src={p.imageUrl ?? '/placeholder.svg'} alt={p.name} className="h-12 w-12 rounded object-cover" />
                  </td>
                  <td className="p-3 font-mono text-xs">{p.code}</td>
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{p.category}</td>
                  <td className="p-3">{fmt(p.priceWholesale)}</td>
                  <td className="p-3">{fmt(p.priceRetail)}</td>
                  <td className="p-3">{p.variants.reduce((a, v) => a + v.stock, 0)}</td>
                  <td className="p-3">{p.countsForWholesale ? 'Sim' : 'Não'}</td>
                  <td className="p-3">{p.active ? 'Sim' : 'Não'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/painel/produtos/${p.id}`} className="text-[#9bbf00] hover:underline">Editar</Link>
                      <ProdutoActions id={p.id} active={p.active} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {produtos.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-3 flex gap-3">
              <img src={p.imageUrl ?? '/placeholder.svg'} alt={p.name} className="h-16 w-16 rounded object-cover flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{p.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.category || 'Sem categoria'}</p>
                <div className="text-sm mt-1">Varejo: {fmt(p.priceRetail)} · Atacado: {fmt(p.priceWholesale)}</div>
                <div className="text-xs text-muted-foreground">
                  Estoque: {p.variants.reduce((a, v) => a + v.stock, 0)} · {p.active ? 'Ativo' : 'Inativo'}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Link href={`/painel/produtos/${p.id}`} className="text-[#9bbf00] hover:underline">Editar</Link>
                  <ProdutoActions id={p.id} active={p.active} />
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
