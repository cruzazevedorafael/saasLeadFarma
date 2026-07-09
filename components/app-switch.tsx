import Link from 'next/link'
import { LayoutDashboard, Store } from 'lucide-react'

// Pílula flutuante pra alternar entre o App Catálogo e o App Painel.
// variant 'catalogo' → botão que leva ao catálogo; 'painel' → leva ao painel.
export function AppSwitch({ href, variant }: { href: string; variant: 'catalogo' | 'painel' }) {
  const catalogo = variant === 'catalogo'
  // painel (mostrado no catálogo) → topo direito; catálogo (mostrado no painel) → base direita
  const pos = catalogo ? 'bottom-4 right-4' : 'top-3 right-3'
  return (
    <Link
      href={href}
      className={`fixed ${pos} z-40 flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur hover:bg-muted`}
    >
      {catalogo ? <Store className="h-3.5 w-3.5 text-brand" /> : <LayoutDashboard className="h-3.5 w-3.5 text-brand" />}
      {catalogo ? 'Ver catálogo' : 'Ir ao painel'}
    </Link>
  )
}
