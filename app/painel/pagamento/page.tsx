// app/painel/pagamento/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPaymentMethods } from '@/lib/data/payment'
import { PagamentoManager } from './_components/pagamento-manager'

export default async function PagamentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const metodos = await getPaymentMethods()

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-2xl space-y-4">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Formas de pagamento</h1>
        <p className="text-sm text-muted-foreground">Acréscimo opcional (% sobre subtotal+frete e/ou valor fixo).</p>
      </div>
      <PagamentoManager metodos={metodos} />
    </div>
  )
}
