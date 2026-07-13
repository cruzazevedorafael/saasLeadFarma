'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScanLine, X } from 'lucide-react'

// Leitor de código de barras pela câmera. BarcodeDetector nativo (Android) com
// fallback @zxing/browser (iOS/todos). Import dinâmico do zxing (pesado).
export function BarcodeScanner({ onDetect }: { onDetect: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} title="Escanear código de barras">
        <ScanLine className="h-4 w-4" /> Escanear
      </Button>
      {open && <ScannerModal onClose={() => setOpen(false)} onDetect={(c) => { onDetect(c); setOpen(false) }} />}
    </>
  )
}

function ScannerModal({ onClose, onDetect }: { onClose: () => void; onDetect: (c: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let zxingControls: { stop: () => void } | null = null

    async function start() {
      try {
        const win = window as any
        if ('BarcodeDetector' in window) {
          const det = new win.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          if (stopped) return
          const v = videoRef.current!
          v.srcObject = stream; await v.play()
          const loop = async () => {
            if (stopped) return
            try {
              const codes = await det.detect(v)
              if (codes[0]?.rawValue) return onDetect(codes[0].rawValue)
            } catch { /* frame sem código */ }
            raf = requestAnimationFrame(loop)
          }
          loop()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (stopped) return
          const reader = new BrowserMultiFormatReader()
          zxingControls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (res) => {
            if (res) onDetect(res.getText())
          })
        }
      } catch {
        setError('Não consegui acessar a câmera. Digite o código abaixo ou permita a câmera nas configurações.')
      }
    }
    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      zxingControls?.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetect])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Escanear código de barras</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>

        {!error ? (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="w-full aspect-[4/3] object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-brand/80" />
          </div>
        ) : (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric" placeholder="ou digite o EAN"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <Button type="button" size="sm" disabled={manual.length < 8} onClick={() => onDetect(manual)}>Usar</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Aponte a câmera para o código de barras do produto.</p>
      </div>
    </div>
  )
}
