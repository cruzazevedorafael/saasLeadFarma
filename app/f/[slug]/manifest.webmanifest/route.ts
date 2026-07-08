// Manifest PWA dinâmico por farmácia (white-label): nome, logo e URL da farmácia.
// Instalável a partir de /f/[slug]. Se a farmácia não existir, cai no genérico.
import { getPharmacyBySlug } from '@/lib/data/pharmacy'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pharmacy = await getPharmacyBySlug(slug)
  const name = pharmacy?.nomeExibicao || pharmacy?.nomeFantasia || 'LeadFarma'
  const start = `/f/${slug}`

  // Ícones: a logo da farmácia (white-label) em primeiro; ícone padrão como fallback
  // e como maskable (tamanho garantido para instalação).
  const icons: Record<string, string>[] = []
  if (pharmacy?.logoUrl) {
    icons.push({ src: pharmacy.logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' })
    icons.push({ src: pharmacy.logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' })
  }
  icons.push({ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' })
  icons.push({ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' })

  const manifest = {
    name,
    short_name: name.slice(0, 12),
    description: `Catálogo ${name} — peça pelo WhatsApp. Powered by LeadFarma.`,
    start_url: start,
    scope: start,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#F97316',
    lang: 'pt-BR',
    icons,
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
