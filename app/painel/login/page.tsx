// app/painel/login/page.tsx
import { login } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-center">Painel Karolla Fit</h1>
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
