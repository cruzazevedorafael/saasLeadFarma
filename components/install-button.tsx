'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share, MoreVertical, Plus } from 'lucide-react'

// Botão "Instalar app" SEMPRE visível (some só se já estiver instalado).
// - Se o navegador oferece o atalho (beforeinstallprompt) → instala com 1 toque.
// - Senão → mostra o passo a passo do aparelho (iPhone/Android/computador).
type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }
type Plataforma = 'ios' | 'android' | 'desktop'

export function InstallButton({ appName = 'o app' }: { appName?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [plataforma, setPlataforma] = useState<Plataforma | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    if (window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true) {
      setInstalled(true)
      return
    }
    const ua = navigator.userAgent
    setPlataforma(/iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop')

    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent) }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || !plataforma) return null

  const onClick = async () => {
    if (deferred) {
      deferred.prompt()
      const r = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }))
      setDeferred(null)
      if (r.outcome === 'accepted') setInstalled(true)
    } else {
      setShowHelp(true)
    }
  }

  return (
    <>
      <button
        onClick={onClick}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-brand/40 bg-background/90 px-4 py-2.5 text-sm font-semibold text-brand shadow-lg backdrop-blur"
      >
        <Download className="h-4 w-4" /> Instalar app
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Instalar {appName}</h3>
              <button onClick={() => setShowHelp(false)} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {plataforma === 'ios' && (
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2">1. Toque em <span className="inline-flex items-center gap-1 font-medium text-foreground"><Share className="h-4 w-4" /> Compartilhar</span> (barra do Safari).</li>
                <li className="flex gap-2">2. Escolha <span className="inline-flex items-center gap-1 font-medium text-foreground"><Plus className="h-4 w-4" /> Adicionar à Tela de Início</span>.</li>
                <li>3. Toque em <span className="font-medium text-foreground">Adicionar</span>. Pronto! 📲</li>
              </ol>
            )}
            {plataforma === 'android' && (
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex gap-2">1. Toque no menu <span className="inline-flex items-center gap-1 font-medium text-foreground"><MoreVertical className="h-4 w-4" /> (⋮)</span> do Chrome (canto superior direito).</li>
                <li>2. Escolha <span className="font-medium text-foreground">“Instalar app”</span> ou <span className="font-medium text-foreground">“Adicionar à tela inicial”</span>.</li>
                <li>3. Confirme em <span className="font-medium text-foreground">Instalar</span>. Pronto! 📲</li>
              </ol>
            )}
            {plataforma === 'desktop' && (
              <ol className="space-y-2.5 text-sm text-muted-foreground">
                <li>1. Na <span className="font-medium text-foreground">barra de endereços</span>, clique no ícone de instalar <span className="font-medium text-foreground">(⊕ / monitor)</span> à direita.</li>
                <li>2. Ou menu <span className="font-medium text-foreground">(⋮)</span> → <span className="font-medium text-foreground">“Instalar {appName}”</span>.</li>
                <li>3. Confirme em <span className="font-medium text-foreground">Instalar</span>. 💻</li>
              </ol>
            )}
            <p className="mt-4 text-[11px] text-muted-foreground">
              O app abre em tela cheia, com a marca da farmácia, direto da tela do aparelho.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
