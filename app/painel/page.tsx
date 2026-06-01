// app/painel/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getStoreSettings } from '@/lib/data/settings'
import { setWholesaleThreshold } from './settings-actions'
import { logout } from './login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function PainelHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')
  const settings = await getStoreSettings()

  async function salvar(formData: FormData) {
    'use server'
    await setWholesaleThreshold(Number(formData.get('threshold')))
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel Karolla Fit</h1>
        <form action={logout}><Button variant="outline" type="submit">Sair</Button></form>
      </div>

      <Link href="/painel/produtos" className="inline-block underline text-[#9bbf00]">Gerenciar produtos →</Link>

      <form action={salvar} className="max-w-sm space-y-2 rounded-xl border border-border p-4">
        <Label htmlFor="threshold" className="text-sm font-medium">Peças para virar atacado</Label>
        <p className="text-xs text-muted-foreground">A partir desta quantidade de peças que contam, o carrinho do cliente vira atacado.</p>
        <div className="flex gap-2">
          <Input id="threshold" name="threshold" type="number" min={1} defaultValue={settings.wholesaleThreshold} className="w-24" />
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </div>
  )
}
