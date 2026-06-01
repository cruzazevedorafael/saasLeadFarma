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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Foto</th>
                <th className="p-3">Código</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Custo</th>
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
                  <td className="p-3">{fmt(p.priceCost)}</td>
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
      )}
    </div>
  )
}
