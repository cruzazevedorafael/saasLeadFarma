// app/f/[slug]/page.tsx — catálogo público de UMA farmácia (resolvido por slug)
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Catalog } from '@/app/_components/catalog'
import { PwaRegister } from '@/components/pwa-register'
import { AppSwitch } from '@/components/app-switch'
import { getSessionProfile } from '@/lib/auth/session'
import { getPharmacyBySlug } from '@/lib/data/pharmacy'
import { getPublicProducts } from '@/lib/data/products'
import { getPublicPromotions } from '@/lib/data/promotions'
import { getPublicShippingMethods } from '@/lib/data/shipping'
import { getPublicPaymentMethods } from '@/lib/data/payment'

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

  const [products, promotions, shippingMethods, paymentMethods, session] = await Promise.all([
    getPublicProducts(pharmacy.id),
    getPublicPromotions(pharmacy.id).catch(() => []),
    getPublicShippingMethods(pharmacy.id).catch(() => []),
    getPublicPaymentMethods(pharmacy.id).catch(() => []),
    getSessionProfile().catch(() => null),
  ])
  const isDona = session?.pharmacyId === pharmacy.id

  return (
    <>
      <PwaRegister />
      {isDona && <AppSwitch href="/painel" variant="painel" />}
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
      />
    </>
  )
}
