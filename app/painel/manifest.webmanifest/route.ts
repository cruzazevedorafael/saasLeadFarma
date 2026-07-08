// Manifest PWA do painel da farmácia (white-label pela farmácia logada).
import { getSessionProfile } from '@/lib/auth/session'
import { getPharmacyById } from '@/lib/data/pharmacy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionProfile()
  const pharmacy = session?.pharmacyId ? await getPharmacyById(session.pharmacyId) : null
  const brand = pharmacy?.nomeExibicao || pharmacy?.nomeFantasia || 'LeadFarma'
  const name = `${brand} · Painel`

  const icons: Record<string, string>[] = []
  if (pharmacy?.logoUrl) {
    icons.push({ src: pharmacy.logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' })
    icons.push({ src: pharmacy.logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' })
  }
  icons.push({ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' })
  icons.push({ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' })

  const manifest = {
    name,
    short_name: brand.slice(0, 12),
    description: `Painel de gestão ${brand} no LeadFarma.`,
    start_url: '/painel',
    scope: '/painel',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#F97316',
    lang: 'pt-BR',
    icons,
  }

  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'private, max-age=0, must-revalidate' },
  })
}
