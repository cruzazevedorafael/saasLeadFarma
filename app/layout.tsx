import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LeadFarma — Catálogo online para farmácias',
  description: 'Catálogo digital para farmácias: monte seu catálogo e receba pedidos pelo WhatsApp, com a sua marca.',
  generator: 'LeadFarma',
  keywords: ['farmácia', 'catálogo online', 'pedidos whatsapp', 'leadfarma'],
}

export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
