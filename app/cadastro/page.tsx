// app/cadastro/page.tsx — auto-cadastro público de farmácia (14 dias grátis).
import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/brand/logo'
import { CadastroForm } from './_components/cadastro-form'
import { PLANS } from '@/lib/asaas/plans'

export const metadata: Metadata = {
  title: 'Criar minha farmácia · LeadFarma',
  description: 'Monte seu catálogo online e receba pedidos pelo WhatsApp. 14 dias grátis.',
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export default function CadastroPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3.5">
          <Link href="/"><Logo size="md" /></Link>
          <Link href="/painel/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition">Já tenho conta</Link>
        </div>
      </header>

      <div className="container mx-auto grid gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            ● 14 dias grátis · sem cartão
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-balance">
            Seu catálogo de farmácia <span className="text-brand">online</span>, pedidos no WhatsApp.
          </h1>
          <p className="text-muted-foreground">
            Cadastre seus produtos, compartilhe o link do catálogo e receba pedidos organizados —
            com comprovante e cadastro de clientes. Comece grátis.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.values(PLANS).map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-brand/40">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="text-sm font-bold text-brand">{brl(p.priceMonthly)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {p.features.map((f) => <li key={f}>• {f}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Escolha o plano depois — o teste de 14 dias libera tudo.</p>
        </div>

        <div className="md:pt-4">
          <CadastroForm />
        </div>
      </div>
    </main>
  )
}
