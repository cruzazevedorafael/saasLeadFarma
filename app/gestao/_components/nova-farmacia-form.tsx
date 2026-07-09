'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarFarmacia } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function NovaFarmaciaForm() {
  const router = useRouter()
  const [nomeFantasia, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [emailAdmin, setEmail] = useState('')
  const [senhaAdmin, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const effectiveSlug = slugTouched ? slug : slugify(nomeFantasia)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErro(null); setOk(null)
    const r = await criarFarmacia({ nomeFantasia, slug: effectiveSlug, emailAdmin, senhaAdmin })
    if (!r.ok) { setErro(r.error); setSaving(false); return }
    setOk(`Farmácia criada! Catálogo em /f/${effectiveSlug}`)
    setNome(''); setSlug(''); setSlugTouched(false); setEmail(''); setSenha('')
    setSaving(false)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border p-4 space-y-3 max-w-lg">
      <h2 className="font-semibold">Nova farmácia</h2>
      <div className="space-y-1">
        <Label htmlFor="nf">Nome da farmácia</Label>
        <Input id="nf" value={nomeFantasia} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="slug">Slug (URL do catálogo)</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">/f/</span>
          <Input id="slug" value={effectiveSlug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }} required />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="em">E-mail de login</Label>
          <Input id="em" type="email" value={emailAdmin} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pw">Senha inicial</Label>
          <Input id="pw" value={senhaAdmin} onChange={(e) => setSenha(e.target.value)} required />
        </div>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {ok && <p className="text-sm text-emerald-600">{ok}</p>}
      <Button type="submit" disabled={saving} className="bg-primary hover:opacity-90 text-white">
        {saving ? 'Criando...' : 'Criar farmácia + login'}
      </Button>
    </form>
  )
}
