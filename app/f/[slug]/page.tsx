// app/f/[slug]/page.tsx — catálogo público de UMA farmácia (resolvido por slug)
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Catalog } from '@/app/_components/catalog'
import { PwaRegister } from '@/components/pwa-register'
import { AppSwitchOwner } from '@/components/app-switch-owner'
import { getPharmacyBySlug, getActivePharmacySlugs } from '@/lib/data/pharmacy'
import { getPublicProducts } from '@/lib/data/products'
import { getPublicPromotions } from '@/lib/data/promotions'
import { catalogFontFamily } from '@/lib/catalog-fonts'
import { getPublicShippingMethods } from '@/lib/data/shipping'
import { getPublicPaymentMethods } from '@/lib/data/payment'

// ISR: o catálogo é servido da CDN e revalidado no máximo a cada 60s. As edições do
// painel disparam revalidação on-demand (revalidatePath('/f/[slug]','page')) → aparecem
// na hora; os 60s são só a rede de segurança. Nenhuma leitura de cookies no render
// (client anônimo nas queries + botão da dona client-side) permite este cache.
export const revalidate = 60

// Prerenderiza no build os catálogos das farmácias ativas (HTML pronto na CDN).
// dynamicParams (padrão true): farmácias novas/não listadas entram por ISR sob demanda.
export async function generateStaticParams() {
  const slugs = await getActivePharmacySlugs()
  return slugs.map((slug) => ({ slug }))
}

// Metadata white-label + PWA: título da farmácia, manifest por slug, ícone da marca.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pharmacy = await getPharmacyBySlug(slug)
  const name = pharmacy?.nomeExibicao || 'Catálogo'
  const icon = pharmacy?.logoUrl || '/icon-192.png'
  return {
    title: `${name} · Catálogo`,
    description: `Catálogo ${name} — peça pelo WhatsApp. Powered by LeadFarma.`,
    manifest: `/f/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: name },
    icons: { icon, apple: icon },
  }
}

export default async function CatalogoFarmacia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pharmacy = await getPharmacyBySlug(slug)
  if (!pharmacy) notFound()

  const [products, promotions, shippingMethods, paymentMethods] = await Promise.all([
    getPublicProducts(pharmacy.id),
    getPublicPromotions(pharmacy.id).catch(() => []),
    getPublicShippingMethods(pharmacy.id).catch(() => []),
    getPublicPaymentMethods(pharmacy.id).catch(() => []),
  ])

  return (
    <>
      <PwaRegister />
      <AppSwitchOwner pharmacyId={pharmacy.id} />
      <Catalog
        products={products}
        threshold={pharmacy.wholesaleThreshold}
        whatsappNumber={pharmacy.whatsappNumber}
        bannerImageUrl={pharmacy.bannerImageUrl}
        promotions={promotions}
        shippingMethods={shippingMethods}
        paymentMethods={paymentMethods}
        pharmacyId={pharmacy.id}
        storeName={pharmacy.nomeExibicao}
        logoUrl={pharmacy.logoUrl}
        accentColor={pharmacy.accentColor}
        fontFamily={catalogFontFamily(pharmacy.catalogFont)}
      />
    </>
  )
}
