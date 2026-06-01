// app/painel/envio/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getShippingMethods } from '@/lib/data/shipping'
import { EnvioManager } from './_components/envio-manager'

export default async function EnvioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const metodos = await getShippingMethods()

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Formas de envio</h1>
        <p className="text-sm text-muted-foreground">O cliente escolhe no carrinho; o frete entra no total.</p>
      </div>
      <EnvioManager metodos={metodos} />
    </div>
  )
}
