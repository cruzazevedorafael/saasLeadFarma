import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

// Tipografia da marca: Plus Jakarta Sans nos títulos (personalidade),
// Inter no corpo (legibilidade). Carregadas de verdade via next/font.
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

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
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
