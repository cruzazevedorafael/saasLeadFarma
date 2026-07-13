// app/painel/_components/painel-header.tsx
// Cabeçalho fixo do painel da farmácia. Presente em TODAS as páginas /painel
// (via layout) — garante retorno ao início pelo site E pelo app (PWA), já que
// o app standalone não tem botão "voltar" do navegador.
import Link from 'next/link'
import { getSessionProfile } from '@/lib/auth/session'
import { getPharmacyById } from '@/lib/data/pharmacy'
import { logout } from '@/app/painel/login/actions'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Store, LogOut } from 'lucide-react'

export async function PainelHeader() {
  const session = await getSessionProfile()
  const ph = session?.pharmacyId ? await getPharmacyById(session.pharmacyId) : null

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        {/* Logo LeadFarma → volta ao início do painel */}
        <Link href="/painel" aria-label="Início do painel" className="transition hover:opacity-80">
          <Logo size="md" />
        </Link>
        <nav className="flex items-center gap-2">
          {ph?.slug && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/f/${ph.slug}`}>
                <Store className="h-4 w-4" /> Ver catálogo
              </Link>
            </Button>
          )}
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </form>
        </nav>
      </div>
    </header>
  )
}
