// app/page.tsx
import { Catalog } from './_components/catalog'
import { getPublicProducts } from '@/lib/data/products'
import { getStoreSettings } from '@/lib/data/settings'
import { getShippingMethods } from '@/lib/data/shipping'
import { getPaymentMethods } from '@/lib/data/payment'

export default async function Home() {
  const [products, settings] = await Promise.all([getPublicProducts(), getStoreSettings()])
  const shippingMethods = await getShippingMethods(true)
  const paymentMethods = await getPaymentMethods(true)
  return <Catalog products={products} threshold={settings.wholesaleThreshold} whatsappNumber={settings.whatsappNumber} shippingMethods={shippingMethods} paymentMethods={paymentMethods} />
}
