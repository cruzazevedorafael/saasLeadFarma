// app/painel/produtos/novo/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProdutoForm } from '../_components/produto-form'

export default async function NovoProduto() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  return <ProdutoForm mode="create" />
}
