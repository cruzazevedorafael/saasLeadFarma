// app/painel/produtos/novo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCategories } from '@/lib/data/categories'
import { ProdutoForm } from '../_components/produto-form'

export default async function NovoProdutoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const categorias = (await getCategories()).map((c) => c.name)
  return <ProdutoForm mode="create" categorias={categorias} />
}
