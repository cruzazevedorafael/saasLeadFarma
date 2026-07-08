// app/page.tsx — landing institucional simples do LeadFarma.
// O catálogo de cada farmácia vive em /f/[slug]; o painel em /painel; a gestão em /gestao.
import Link from 'next/link'

export const metadata = {
  title: 'LeadFarma — Catálogo online para farmácias',
  description: 'A sua farmácia com catálogo digital e pedidos pelo WhatsApp.',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-xl space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-[#F97316] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-[#F97316]/30">
          L
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
          Lead<span className="text-[#F97316]">Farma</span>
        </h1>
        <p className="text-base md:text-lg text-muted-foreground">
          Catálogo online para farmácias. Sua farmácia monta o catálogo, o cliente pede pelo WhatsApp —
          rápido, simples e com a sua marca.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/cadastro"
            className="rounded-full bg-[#F97316] px-6 py-3 font-semibold text-white hover:opacity-90 transition"
          >
            Criar minha farmácia
          </Link>
          <Link
            href="/painel/login"
            className="rounded-full border border-border px-6 py-3 font-semibold hover:bg-muted transition"
          >
            Acessar painel
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">14 dias grátis · sem cartão</p>
      </div>
    </main>
  )
}
