// app/f/[slug]/page.tsx — catálogo público de UMA farmácia (resolvido por slug)
import { notFound } from 'next/navigation'
import { Catalog } from '@/app/_components/catalog'
import { getPharmacyBySlug } from '@/lib/data/pharmacy'
import { getPublicProducts } from '@/lib/data/products'
import { getPublicShippingMethods } from '@/lib/data/shipping'
import { getPublicPaymentMethods } from '@/lib/data/payment'

export default async function CatalogoFarmacia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pharmacy = await getPharmacyBySlug(slug)
  if (!pharmacy) notFound()

  const [products, shippingMethods, paymentMethods] = await Promise.all([
    getPublicProducts(pharmacy.id),
    getPublicShippingMethods(pharmacy.id).catch(() => []),
    getPublicPaymentMethods(pharmacy.id).catch(() => []),
  ])

  return (
    <Catalog
      products={products}
      threshold={pharmacy.wholesaleThreshold}
      whatsappNumber={pharmacy.whatsappNumber}
      bannerImageUrl={pharmacy.bannerImageUrl}
      shippingMethods={shippingMethods}
      paymentMethods={paymentMethods}
      pharmacyId={pharmacy.id}
      storeName={pharmacy.nomeExibicao}
      logoUrl={pharmacy.logoUrl}
    />
  )
}
