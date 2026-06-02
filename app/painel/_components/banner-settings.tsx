'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadBannerImage, setBannerImage } from '../settings-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function BannerSettings({ current }: { current: string }) {
  const router = useRouter()
  const [preview, setPreview] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadBannerImage(file)
      await setBannerImage(url)
      setPreview(url)
      router.refresh()
    } catch {
      setError('Falha ao subir a imagem.')
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    setBusy(true)
    setError(null)
    try {
      await setBannerImage('')
      setPreview('')
      router.refresh()
    } catch {
      setError('Falha ao remover.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm space-y-3 rounded-xl border border-border p-4">
      <Label className="text-sm font-medium">Banner da página inicial</Label>
      <p className="text-xs text-muted-foreground">
        Imagem que aparece abaixo do logo, na página inicial da loja. Deixe sem imagem para não mostrar nada.
      </p>
      {preview ? (
        <img src={preview} alt="Banner atual" className="w-full rounded-lg object-cover max-h-40" />
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum banner definido.</p>
      )}
      <Input type="file" accept="image/*" onChange={onUpload} disabled={busy} />
      {busy && <p className="text-xs text-muted-foreground">Salvando...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {preview && (
        <Button type="button" variant="outline" size="sm" onClick={onRemove} disabled={busy}>
          Remover banner
        </Button>
      )}
    </div>
  )
}
