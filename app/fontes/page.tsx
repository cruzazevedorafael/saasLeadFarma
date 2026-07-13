// app/fontes/page.tsx — PÁGINA TEMPORÁRIA de comparação de fontes de título.
// Escolha uma e me avise; aí eu aplico e removo esta rota.
import { Bricolage_Grotesque, Sora, Space_Grotesk } from 'next/font/google'
import { LogoMark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Package, ChevronRight } from 'lucide-react'

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700', '800'] })
const sora = Sora({ subsets: ['latin'], weight: ['600', '700', '800'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] })

const OPCOES = [
  { id: 'A', nome: 'Bricolage Grotesque', vibe: 'Editorial · premium · com caráter (atual)', cls: bricolage.className },
  { id: 'B', nome: 'Sora', vibe: 'Geométrica · sóbria · tech (tipo Linear/Vercel)', cls: sora.className },
  { id: 'C', nome: 'Space Grotesk', vibe: 'Moderna · técnica · marcante', cls: spaceGrotesk.className },
]

function Amostra({ nome, vibe, cls, id }: { nome: string; vibe: string; cls: string; id: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="eyebrow">Opção {id}</span>
          <h2 className={`${cls} mt-1 text-lg font-bold tracking-tight`}>{nome}</h2>
        </div>
        <span className="text-xs text-muted-foreground text-right max-w-[9rem]">{vibe}</span>
      </div>

      <div className="hairline" />

      {/* amostra: landing */}
      <div className="space-y-2">
        <span className="eyebrow">LeadFarma · Catálogo</span>
        <h1 className={`${cls} text-3xl font-extrabold tracking-tight leading-[1.05]`}>
          Seu catálogo de farmácia <span className="text-brand">online</span>, pedidos no WhatsApp.
        </h1>
        <p className="text-sm text-muted-foreground">
          Monte o catálogo, compartilhe o link e receba pedidos organizados — com a sua marca.
        </p>
      </div>

      {/* amostra: números / preço */}
      <div className="flex items-baseline gap-4">
        <span className={`${cls} text-2xl font-bold`}>R$ 1.480,90</span>
        <span className={`${cls} text-2xl font-bold text-brand`}>128 pedidos</span>
      </div>

      {/* amostra: card de painel */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Package className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`${cls} block font-semibold leading-tight`}>Produtos</span>
          <span className="block text-xs text-muted-foreground">Cadastro e estoque</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex gap-2">
        <Button className="shadow-brand">Criar minha farmácia</Button>
        <Button variant="outline">Acessar painel</Button>
      </div>
    </div>
  )
}

export default function CompararFontes() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <LogoMark size="lg" />
          <div>
            <span className="eyebrow">Comparar fontes de título</span>
            <h1 className="font-display text-2xl font-bold tracking-tight leading-none mt-1">
              Qual estilo de letra fica melhor?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Só os títulos mudam (o corpo continua Inter). Me diga <b>A</b>, <b>B</b> ou <b>C</b> — aplico e removo esta página.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {OPCOES.map((o) => <Amostra key={o.id} {...o} />)}
        </div>
      </div>
    </main>
  )
}
