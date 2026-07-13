// app/painel/page.tsx
import Link from 'next/link'
import { requirePharmacyAdmin } from '@/lib/auth/guards'
import { getStoreSettings } from '@/lib/data/settings'
import { getPromotions } from '@/lib/data/promotions'
import { setWholesaleThreshold, setStoreContact } from './settings-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionsSettings } from './_components/promotions-settings'
import { LogoSettings } from './_components/logo-settings'
import { SectionHeader } from '@/components/ui/section-header'
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
  const { pharmacyId } = await requirePharmacyAdmin()
  const [settings, promotions] = await Promise.all([
    getStoreSettings(),
    getPromotions(pharmacyId!),
  ])

  async function salvarLimite(formData: FormData) {
    'use server'
    await setWholesaleThreshold(Number(formData.get('threshold')))
  }
  async function salvarContato(formData: FormData) {
    'use server'
    await setStoreContact(String(formData.get('storeName') ?? ''), String(formData.get('whatsapp') ?? ''))
  }

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-10">
      <div>
        <span className="eyebrow">Painel da farmácia</span>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight leading-none">{settings.storeName}</h1>
      </div>

      <section className="space-y-4">
        <SectionHeader label="Gerenciar" title="Atalhos da loja" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {NAV.map(({ href, label, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-brand/50 hover:shadow-md hover:-translate-y-0.5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
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
      </section>

      <div className="hairline" />

      <section className="space-y-4">
        <SectionHeader label="Configurações" title="Dados e preferências da loja" description="Ajustes que valem para o seu catálogo e comprovantes." />
        <div className="grid gap-4 sm:grid-cols-2">
          <form action={salvarLimite} className="space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
            <Label htmlFor="threshold" className="text-sm font-medium">Quantidade para o preço por atacado</Label>
            <p className="text-xs text-muted-foreground">A partir desta quantidade de itens que contam, o carrinho do cliente passa a usar o preço por quantidade.</p>
            <div className="flex gap-2">
              <Input id="threshold" name="threshold" type="number" min={1} defaultValue={settings.wholesaleThreshold} className="w-24" />
              <Button type="submit">Salvar</Button>
            </div>
          </form>

          <form action={salvarContato} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
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

        <LogoSettings current={settings.logoUrl} currentColor={settings.accentColor} />

        <PromotionsSettings promotions={promotions} />
      </section>
    </div>
  )
}
