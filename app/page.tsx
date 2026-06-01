// app/page.tsx
import { Catalog } from './_components/catalog'
import { getPublicProducts } from '@/lib/data/products'
import { getStoreSettings } from '@/lib/data/settings'
import { getShippingMethods } from '@/lib/data/shipping'
import { getPaymentMethods } from '@/lib/data/payment'

export default async function Home() {
  const [products, settings] = await Promise.all([getPublicProducts(), getStoreSettings()])
  // Vitrine resiliente: se as tabelas de envio/pagamento ainda não existirem
  // (migrations não aplicadas), a loja não cai — os seletores só ficam vazios ("A combinar").
  const shippingMethods = await getShippingMethods(true).catch(() => [])
  const paymentMethods = await getPaymentMethods(true).catch(() => [])
  return <Catalog products={products} threshold={settings.wholesaleThreshold} whatsappNumber={settings.whatsappNumber} shippingMethods={shippingMethods} paymentMethods={paymentMethods} />
}
