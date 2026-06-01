// app/painel/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStoreSettings } from '@/lib/data/settings'
import { setWholesaleThreshold, setStoreContact } from './settings-actions'
import { logout } from './login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function PainelHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const settings = await getStoreSettings()

  async function salvarLimite(formData: FormData) {
    'use server'
    await setWholesaleThreshold(Number(formData.get('threshold')))
  }
  async function salvarContato(formData: FormData) {
    'use server'
    await setStoreContact(String(formData.get('storeName') ?? ''), String(formData.get('whatsapp') ?? ''))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel Karolla Fit</h1>
        <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href="/painel/produtos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Produtos</Link>
        <Link href="/painel/categorias" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Categorias</Link>
        <Link href="/painel/envio" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Envio</Link>
        <Link href="/painel/pagamento" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pagamento</Link>
        <Link href="/painel/pedidos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pedidos</Link>
        <Link href="/painel/financeiro" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Financeiro</Link>
      </div>

      <form action={salvarLimite} className="max-w-sm space-y-2 rounded-xl border border-border p-4">
        <Label htmlFor="threshold" className="text-sm font-medium">Peças para virar atacado</Label>
        <p className="text-xs text-muted-foreground">A partir desta quantidade de peças que contam, o carrinho do cliente vira atacado.</p>
        <div className="flex gap-2">
          <Input id="threshold" name="threshold" type="number" min={1} defaultValue={settings.wholesaleThreshold} className="w-24" />
          <Button type="submit">Salvar</Button>
        </div>
      </form>

      <form action={salvarContato} className="max-w-sm space-y-3 rounded-xl border border-border p-4">
        <div className="space-y-1">
          <Label htmlFor="storeName" className="text-sm font-medium">Nome da loja</Label>
          <Input id="storeName" name="storeName" defaultValue={settings.storeName} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp da loja</Label>
          <p className="text-xs text-muted-foreground">Com código do país e DDD, só números. Ex: 5511999998888</p>
          <Input id="whatsapp" name="whatsapp" defaultValue={settings.whatsappNumber} placeholder="5511999998888" />
        </div>
        <Button type="submit">Salvar contato</Button>
      </form>
    </div>
  )
}
