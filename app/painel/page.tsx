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
import { LogoSettings } from './_components/logo-settings'
import { Package, Tags, Truck, CreditCard, ShoppingBag, Users, BarChart3, Star, Building2, ChevronRight } from 'lucide-react'

const NAV = [
  { href: '/painel/produtos', label: 'Produtos', desc: 'Cadastro e estoque', Icon: Package },
  { href: '/painel/pedidos', label: 'Pedidos', desc: 'Vendas recebidas', Icon: ShoppingBag },
  { href: '/painel/clientes', label: 'Clientes', desc: 'Cadastro e histórico', Icon: Users },
  { href: '/painel/relatorios', label: 'Relatórios', desc: 'Vendas e desempenho', Icon: BarChart3 },
  { href: '/painel/categorias', label: 'Categorias', desc: 'Organizar o catálogo', Icon: Tags },
  { href: '/painel/envio', label: 'Envio', desc: 'Formas de entrega', Icon: Truck },
  { href: '/painel/pagamento', label: 'Pagamento', desc: 'Formas de pagamento', Icon: CreditCard },
  { href: '/painel/assinatura', label: 'Assinatura', desc: 'Plano e cobrança', Icon: Star },
  { href: '/painel/cadastro', label: 'Dados da farmácia', desc: 'Cadastro e comprovantes', Icon: Building2 },
]

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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {NAV.map(({ href, label, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-[#F97316]/50 hover:bg-muted/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/10 text-[#F97316]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-tight truncate">{label}</span>
              <span className="block text-xs text-muted-foreground truncate">{desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configurações da loja</h2>

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

      <LogoSettings current={settings.logoUrl} currentColor={settings.accentColor} />

      <BannerSettings current={settings.bannerImageUrl} />
    </div>
  )
}
