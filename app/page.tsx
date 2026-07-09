// app/page.tsx — landing institucional simples do LeadFarma.
// O catálogo de cada farmácia vive em /f/[slug]; o painel em /painel; a gestão em /gestao.
import Link from 'next/link'
import { LogoMark } from '@/components/brand/logo'

export const metadata = {
  title: 'LeadFarma — Catálogo online para farmácias',
  description: 'A sua farmácia com catálogo digital e pedidos pelo WhatsApp.',
}

export default function Home() {
  return (
    <main className="relative min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* brilho quente de fundo, discreto */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, var(--brand-soft), transparent)' }}
      />
      <div className="relative max-w-xl space-y-7">
        <LogoMark size="xl" className="mx-auto shadow-brand rounded-2xl" />
        <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight">
          Lead<span className="text-brand">Farma</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground text-balance">
          Catálogo online para farmácias. Sua farmácia monta o catálogo, o cliente pede pelo WhatsApp —
          rápido, simples e com a sua marca.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/cadastro"
            className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-brand transition hover:brightness-105 active:brightness-95"
          >
            Criar minha farmácia
          </Link>
          <Link
            href="/painel/login"
            className="rounded-full border border-border bg-card px-6 py-3 font-semibold shadow-sm transition hover:bg-accent"
          >
            Acessar painel
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">14 dias grátis · sem cartão</p>
      </div>
    </main>
  )
}
