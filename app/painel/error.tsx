// app/painel/error.tsx
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function PainelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-ink-foreground">
      <Logo size="lg" className="text-ink-foreground" />
      <h1 className="font-display text-2xl font-bold">Algo deu errado no painel</h1>
      <p className="max-w-sm text-sm text-ink-foreground/70">
        Já fomos avisados. Tente de novo — se continuar, fale com o suporte.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
        >
          Tentar de novo
        </button>
        <Link
          href="/painel"
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-ink-foreground transition hover:bg-white/10"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  )
}
