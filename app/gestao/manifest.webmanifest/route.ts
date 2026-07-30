// Manifest PWA da gestão da plataforma (marca LeadFarma — NÃO white-label).
export const dynamic = 'force-static'

export function GET() {
  const manifest = {
    name: 'LeadFarma · Gestão',
    short_name: 'LeadFarma',
    description: 'Gestão da plataforma LeadFarma.',
    start_url: '/gestao',
    scope: '/gestao',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#F97316',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=0, must-revalidate' },
  })
}
