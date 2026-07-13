import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

// Tipografia da marca: Bricolage Grotesque nos títulos — grotesca editorial,
// madura e com caráter (premium, não "app genérico"). Inter no corpo.
const display = Bricolage_Grotesque({
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
