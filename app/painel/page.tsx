// app/painel/page.tsx
import Link from 'next/link'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getStoreSettings } from '@/lib/data/settings'
import { setWholesaleThreshold, setStoreContact } from './settings-actions'
import { logout } from './login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BannerSettings } from './_components/banner-settings'

export default async function PainelHome() {
  await requirePharmacyAdmin()
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
        <div>
          <h1 className="text-2xl font-bold">{settings.storeName}</h1>
          <p className="text-xs text-muted-foreground">Painel · <span className="text-[#F97316] font-medium">LeadFarma</span></p>
        </div>
        <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href="/painel/produtos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Produtos</Link>
        <Link href="/painel/categorias" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Categorias</Link>
        <Link href="/painel/envio" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Envio</Link>
        <Link href="/painel/pagamento" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pagamento</Link>
        <Link href="/painel/pedidos" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Pedidos</Link>
        <Link href="/painel/clientes" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Clientes</Link>
        <Link href="/painel/cadastro" className="rounded-lg border border-border px-4 py-2 hover:bg-muted">Dados da farmácia</Link>
      </div>

      <form action={salvarLimite} className="max-w-sm space-y-2 rounded-xl border border-border p-4">
        <Label htmlFor="threshold" className="text-sm font-medium">Quantidade para o preço por atacado</Label>
        <p className="text-xs text-muted-foreground">A partir desta quantidade de itens que contam, o carrinho do cliente passa a usar o preço por quantidade.</p>
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

      <BannerSettings current={settings.bannerImageUrl} />
    </div>
  )
}
