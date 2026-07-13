// app/gestao/layout.tsx — área de gestão da plataforma (só super-admin).
import Link from 'next/link'
import { requireSuperadmin } from '@/lib/auth/guards'
import { logout } from '@/app/painel/login/actions'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin()
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {/* Logo LeadFarma → volta ao início da gestão */}
            <Link href="/gestao" aria-label="Início da gestão" className="transition hover:opacity-80">
              <Logo size="md" />
            </Link>
            <span className="hidden sm:inline rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Gestão da plataforma
            </span>
          </div>
          <form action={logout}><Button variant="ghost" size="sm" type="submit"><LogOut className="h-4 w-4" /> Sair</Button></form>
        </div>
      </header>
      {children}
    </div>
  )
}
