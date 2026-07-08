'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

// Botão "Instalar app" (PWA). No Android/desktop usa o beforeinstallprompt (1 toque);
// no iPhone (Safari não dispara o evento) mostra o passo a passo do "Adicionar à
// Tela de Início". Some sozinho se o app já estiver instalado.
type BIPEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }

export function InstallButton({ appName = 'o app' }: { appName?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
    if (standalone) return // já instalado → não mostra nada

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)
    if (ios) setHidden(false) // no iOS mostramos o botão de instruções

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
      setHidden(false)
    }
    const onInstalled = () => { setHidden(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden) return null

  const onClick = async () => {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice.catch(() => {})
      setDeferred(null)
      setHidden(true)
    } else {
      setShowHelp(true)
    }
  }

  return (
    <>
      <button
        onClick={onClick}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-[#F97316]/40 bg-background/90 px-4 py-2.5 text-sm font-semibold text-[#F97316] shadow-lg backdrop-blur"
      >
        <Download className="h-4 w-4" /> Instalar app
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Instalar {appName}</h3>
              <button onClick={() => setShowHelp(false)} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Toque no botão <span className="inline-flex items-center gap-1 font-medium text-foreground"><Share className="h-4 w-4" /> Compartilhar</span> do Safari (embaixo).</li>
              <li>2. Escolha <span className="font-medium text-foreground">“Adicionar à Tela de Início”</span>.</li>
              <li>3. Toque em <span className="font-medium text-foreground">Adicionar</span>. Pronto — o app fica na tela do celular. 📲</li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
