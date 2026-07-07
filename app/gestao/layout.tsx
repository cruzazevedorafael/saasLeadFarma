// app/gestao/layout.tsx — área de gestão da plataforma (só super-admin).
import { requireSuperadmin } from '@/lib/auth/guards'
import { logout } from '@/app/painel/login/actions'
import { Button } from '@/components/ui/button'

export default async function GestaoLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin()
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#F97316] flex items-center justify-center text-white font-bold">L</div>
            <div>
              <span className="font-bold">Lead<span className="text-[#F97316]">Farma</span></span>
              <span className="ml-2 text-xs text-muted-foreground">Gestão da plataforma</span>
            </div>
          </div>
          <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
        </div>
      </header>
      {children}
    </div>
  )
}
