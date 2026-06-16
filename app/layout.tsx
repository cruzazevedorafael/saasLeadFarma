import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KAROLLA FIT | Moda Fitness Atacado e Varejo',
  description: 'As melhores roupas fitness com preços para atacado e varejo. Leggings, tops, conjuntos e mais!',
  generator: 'v0.app',
  keywords: ['moda fitness', 'roupa fitness', 'atacado', 'varejo', 'legging', 'top fitness'],
  icons: {
    icon: '/logo.jpeg',
    apple: '/logo.jpeg',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
