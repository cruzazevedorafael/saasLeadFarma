// app/painel/login/page.tsx
import { login } from './actions'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-7 shadow-lg">
        <div className="flex flex-col items-center gap-1">
          <Logo size="lg" />
          <p className="text-xs text-muted-foreground">Acesso ao painel</p>
        </div>
        {erro && <p className="text-sm text-destructive text-center">E-mail ou senha inválidos.</p>}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        <Button type="submit" className="w-full">Entrar</Button>
      </form>
    </div>
  )
}
