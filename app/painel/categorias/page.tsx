// app/painel/categorias/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCategories } from '@/lib/data/categories'
import { CategoriasManager } from './_components/categorias-manager'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const categorias = await getCategories()

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-xl space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Categorias</h1>
        <p className="text-sm text-muted-foreground">Crie, renomeie ou apague. Não dá pra apagar categoria em uso.</p>
      </div>
      <CategoriasManager categorias={categorias} />
    </div>
  )
}
