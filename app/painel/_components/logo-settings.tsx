'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadLogoImage, setLogo } from '../settings-actions'
import { compressImage } from '@/lib/compress-image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Extrai uma cor de destaque da logo: média das cores vivas, ajustada pra ter
// bom contraste no fundo branco (nem clara demais). Roda no navegador (canvas).
async function extractAccent(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url
    })
    const size = 48
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    URL.revokeObjectURL(url)
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3]
      if (A < 128) continue
      const max = Math.max(R, G, B), min = Math.min(R, G, B)
      const sat = max === 0 ? 0 : (max - min) / max
      if (sat < 0.25) continue          // ignora cinza/branco/preto
      if (max > 245 && min > 245) continue
      r += R; g += G; b += B; n++
    }
    if (n === 0) return null
    r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n)
    // se ficar clara demais, escurece pra contrastar no branco
    let lum = (0.299 * r + 0.587 * g + 0.114 * b)
    while (lum > 175) { r = Math.round(r * 0.85); g = Math.round(g * 0.85); b = Math.round(b * 0.85); lum = (0.299 * r + 0.587 * g + 0.114 * b) }
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    return hex
  } catch {
    return null
  }
}

export function LogoSettings({ current, currentColor }: { current: string | null; currentColor: string | null }) {
  const router = useRouter()
  const [preview, setPreview] = useState(current ?? '')
  const [cor, setCor] = useState(currentColor ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError(null)
    try {
      const accent = await extractAccent(file)
      const compressed = await compressImage(file)
      const url = await uploadLogoImage(compressed)
      await setLogo(url, accent)
      setPreview(url); setCor(accent ?? '')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao subir a logo.')
    } finally {
      setBusy(false); e.target.value = ''
    }
  }

  const onRemove = async () => {
    setBusy(true); setError(null)
    try {
      await setLogo('', null)
      setPreview(''); setCor('')
      router.refresh()
    } catch {
      setError('Falha ao remover.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm space-y-3 rounded-xl border border-border p-4">
      <Label className="text-sm font-medium">Logotipo da farmácia</Label>
      <p className="text-xs text-muted-foreground">
        Aparece no catálogo e vira o ícone do app. A cor do catálogo se adapta à sua logo.
      </p>
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="Logo atual" className="h-16 w-16 rounded-lg object-contain bg-muted p-1" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">sem logo</div>
        )}
        {cor && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-6 w-6 rounded-full border border-border" style={{ background: cor }} />
            cor da marca: <span className="font-mono">{cor}</span>
          </div>
        )}
      </div>
      <Input type="file" accept="image/*" onChange={onUpload} disabled={busy} />
      {busy && <p className="text-xs text-muted-foreground">Salvando...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {preview && (
        <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={busy}>Remover logo</Button>
      )}
    </div>
  )
}
