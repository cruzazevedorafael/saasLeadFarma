// app/f/[slug]/error.tsx
'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Logo } from '@/components/brand/logo'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size="lg" />
      <h1 className="font-display text-2xl font-bold">Ops, algo travou aqui</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Não foi você — foi a gente. Já fomos avisados. Tente de novo em instantes.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
      >
        Tentar de novo
      </button>
    </div>
  )
}
