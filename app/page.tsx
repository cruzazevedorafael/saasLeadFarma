// app/page.tsx
import { Catalog } from './_components/catalog'
import { getPublicProducts } from '@/lib/data/products'
import { getStoreSettings } from '@/lib/data/settings'

export default async function Home() {
  const [products, settings] = await Promise.all([getPublicProducts(), getStoreSettings()])
  return <Catalog products={products} threshold={settings.wholesaleThreshold} />
}
