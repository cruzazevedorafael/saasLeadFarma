// app/painel/produtos/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getAdminProduct } from '@/lib/data/products'
import { getCategories } from '@/lib/data/categories'
import { ProdutoForm } from '../_components/produto-form'

export default async function EditarProduto({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const { id } = await params
  const produto = await getAdminProduct(id)
  if (!produto) notFound()
  const categorias = (await getCategories()).map((c) => c.name)
  return <ProdutoForm mode="edit" produto={produto} categorias={categorias} />
}
