// app/gestao/layout.tsx — área de gestão da plataforma (só super-admin).
import { requireSuperadmin } from '@/lib/auth/guards'
import { logout } from '@/app/painel/login/actions'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin()
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="hidden sm:inline rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Gestão da plataforma
            </span>
          </div>
          <form action={logout}><Button variant="outline" size="sm" type="submit">Sair</Button></form>
        </div>
      </header>
      {children}
    </div>
  )
}
