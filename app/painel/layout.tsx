// app/painel/layout.tsx
import type { Metadata } from 'next'
import { PwaRegister } from '@/components/pwa-register'
import { InstallButton } from '@/components/install-button'
import { VerCatalogo } from './_components/ver-catalogo'

export const metadata: Metadata = {
  title: 'Painel · LeadFarma',
  manifest: '/painel/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Painel' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PwaRegister />
      <VerCatalogo />
      {children}
      <InstallButton appName="Painel LeadFarma" />
    </div>
  )
}
