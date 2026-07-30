// app/f/[slug]/not-found.tsx
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo size="lg" />
      <h1 className="font-display text-2xl font-bold">Loja não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Esse link de catálogo não existe ou não está mais ativo. Confira o link com a farmácia.
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
