import Link from 'next/link'
import { LayoutDashboard, Store } from 'lucide-react'

// Botão flutuante para a DONA da farmácia alternar entre o catálogo e o painel.
// Só é renderizado quando o dono está logado (ver app/f/[slug]/page.tsx).
// variant 'painel' → mostrado no catálogo, leva ao painel; 'catalogo' → o inverso.
export function AppSwitch({ href, variant }: { href: string; variant: 'catalogo' | 'painel' }) {
  const catalogo = variant === 'catalogo'
  return (
    <Link
      href={href}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition hover:brightness-110 active:scale-95"
    >
      {catalogo ? <Store className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
      {catalogo ? 'Ver catálogo' : 'Ir ao meu painel'}
    </Link>
  )
}
