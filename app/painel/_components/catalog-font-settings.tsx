'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setCatalogFont } from '../settings-actions'
import { CATALOG_FONT_OPTIONS } from '@/lib/catalog-fonts.options'
import { Label } from '@/components/ui/label'

export function CatalogFontSettings({ current }: { current: string | null }) {
  const router = useRouter()
  const [val, setVal] = useState(current ?? 'padrao')
  const [pending, start] = useTransition()

  const onChange = (key: string) => {
    setVal(key)
    start(async () => { await setCatalogFont(key); router.refresh() })
  }

  return (
    <div className="max-w-sm space-y-2 rounded-xl border border-border bg-card p-5 shadow-sm">
      <Label htmlFor="catalog-font" className="text-sm font-medium">Fonte do catálogo</Label>
      <p className="text-xs text-muted-foreground">
        A tipografia do seu catálogo (títulos e textos). Escolha a que combina com a sua marca — vale só no catálogo.
      </p>
      <select
        id="catalog-font"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
      >
        {CATALOG_FONT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      {pending && <span className="text-xs text-muted-foreground">Salvando…</span>}
    </div>
  )
}
