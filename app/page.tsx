// app/page.tsx — landing institucional do LeadFarma.
// O catálogo de cada farmácia vive em /f/[slug]; o painel em /painel; a gestão em /gestao.
import Link from 'next/link'
import {
  MessageCircle,
  ShoppingBag,
  Users,
  Receipt,
  BarChart3,
  Smartphone,
  Palette,
} from 'lucide-react'
import { LandingNav } from '@/components/landing/landing-nav'
import { HeroMockup } from '@/components/landing/hero-mockup'
import { PainelPreview } from '@/components/landing/painel-preview'
import { Reveal } from '@/components/landing/reveal'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { PLANS } from '@/lib/asaas/plans'

export const metadata = {
  title: 'LeadFarma — Catálogo online para farmácias',
  description: 'Catálogo digital para farmácias: monte seu catálogo e receba pedidos pelo WhatsApp, com a sua marca.',
}

const PROBLEMAS = [
  {
    titulo: 'Preço no caderninho',
    texto: 'Cliente pergunta valor, você para o balcão pra procurar. De novo, e de novo.',
  },
  {
    titulo: 'Pedido perdido na conversa',
    texto: 'O pedido some entre 200 conversas do WhatsApp e só aparece quando o cliente cobra.',
  },
  {
    titulo: 'Foto solta no Status',
    texto: 'Promoção no Status some em 24h e não tem como o cliente montar o pedido sozinho.',
  },
]

const PASSOS = [
  {
    numero: '1',
    titulo: 'Monte seu catálogo',
    texto: 'Cadastre os produtos direto no painel — um a um, com preço, apresentação e dosagem.',
  },
  {
    numero: '2',
    titulo: 'Compartilhe o link',
    texto: 'Um link só, com a sua marca e sua cor, pra colocar no Status, Instagram ou perfil do WhatsApp.',
  },
  {
    numero: '3',
    titulo: 'Receba o pedido pronto',
    texto: 'O cliente monta o carrinho sozinho e o pedido chega organizado, pronto pra você confirmar.',
  },
]

const RECURSOS = [
  {
    titulo: 'Catálogo com a sua marca',
    texto: 'Logo, cor de destaque e fonte personalizáveis — o catálogo parece seu, não um template genérico.',
    icon: Palette,
    grande: true,
  },
  {
    titulo: 'Pedidos pelo WhatsApp',
    texto: 'O cliente monta o carrinho e finaliza direto no seu WhatsApp, sem trocar de número.',
    icon: MessageCircle,
  },
  {
    titulo: 'Clientes com histórico',
    texto: 'Cadastro com CPF e consentimento LGPD, histórico de compras por cliente.',
    icon: Users,
  },
  {
    titulo: 'Comprovante pronto',
    texto: 'Recibo em A4 ou cupom 58mm, com os dados da sua farmácia, direto do pedido.',
    icon: Receipt,
  },
  {
    titulo: 'Relatórios de vendas',
    texto: 'Faturamento, ticket médio e mais vendidos, por dia, mês ou período que você escolher.',
    icon: BarChart3,
  },
]

const FAQS = [
  {
    q: 'Preciso pagar alguma coisa pra testar?',
    a: 'Não. São 14 dias grátis, sem pedir cartão de crédito.',
  },
  {
    q: 'Meus clientes precisam baixar algum aplicativo?',
    a: 'Não. O catálogo é um link que abre no navegador; instalar como app é opcional, pra quem quiser atalho na tela inicial.',
  },
  {
    q: 'Quem responde as mensagens no WhatsApp?',
    a: 'Você, como sempre. O LeadFarma só organiza o pedido antes de ele chegar até você — o atendimento continua no seu WhatsApp de sempre.',
  },
  {
    q: 'Dá pra usar minha marca e minhas cores?',
    a: 'Sim. Logo, cor de destaque e fonte do catálogo são personalizáveis pra cada farmácia.',
  },
  {
    q: 'Tem contrato de fidelidade?',
    a: 'Não. O cancelamento é livre, direto no painel, sem multa.',
  },
  {
    q: 'Como cadastro meus produtos?',
    a: 'Direto no painel, um a um — o cadastro rápido permite adicionar produto e ajustar estoque sem abrir formulário completo.',
  },
]

export default function Home() {
  return (
    <main className="bg-background text-foreground">
      <LandingNav />

      {/* Hero — bloco escuro-âncora */}
      <section className="relative overflow-hidden bg-ink pb-20 pt-32 text-ink-foreground md:pb-28 md:pt-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-40"
          style={{ background: 'radial-gradient(closest-side, color-mix(in oklch, var(--brand) 30%, transparent), transparent)' }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 md:grid-cols-2 md:items-center md:gap-8 md:px-6">
          <div className="max-w-xl">
            <span className="eyebrow text-ink-foreground/60">Catálogo online para farmácias</span>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
              Pare de fechar venda pelo <span className="text-brand">Status</span> do WhatsApp.
            </h1>
            <p className="mt-5 text-base text-ink-foreground/75 md:text-lg text-pretty">
              O LeadFarma dá um catálogo digital com a sua marca pra sua farmácia — o cliente monta o
              pedido sozinho, você recebe pronto pra enviar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/cadastro"
                className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-brand transition hover:brightness-105 active:brightness-95"
              >
                Criar minha farmácia
              </Link>
              <Link
                href="/painel/login"
                className="rounded-full border border-white/20 px-6 py-3 font-semibold text-ink-foreground transition hover:bg-white/10"
              >
                Acessar painel
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-foreground/50">14 dias grátis · sem cartão</p>
          </div>
          <Reveal delay={0.15}>
            <HeroMockup />
          </Reveal>
        </div>
      </section>

      {/* O problema */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Reveal>
            <span className="eyebrow">O dia a dia hoje</span>
            <h2 className="mt-3 max-w-lg font-display text-2xl font-bold tracking-tight text-balance md:text-3xl">
              Sua farmácia já vende bem. O problema é o tempo que se perde no meio do caminho.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PROBLEMAS.map((p, i) => (
              <Reveal key={p.titulo} delay={i * 0.06}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <h3 className="font-display text-lg font-bold">{p.titulo}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-secondary/40 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Reveal>
            <span className="eyebrow">Como funciona</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Três passos, sem depender de ninguém
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {PASSOS.map((p, i) => (
              <Reveal key={p.numero} delay={i * 0.08}>
                <div className="font-display text-4xl font-extrabold text-brand">{p.numero}</div>
                <h3 className="mt-3 font-display text-lg font-bold">{p.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos — bento */}
      <section id="recursos" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Reveal>
            <span className="eyebrow">Recursos</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Tudo que a sua farmácia precisa pra vender online
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {RECURSOS.map((r, i) => (
              <Reveal
                key={r.titulo}
                delay={i * 0.05}
                className={r.grande ? 'md:col-span-2 md:row-span-2' : undefined}
              >
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-brand/40 hover:shadow-md">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <r.icon className="size-4" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold">{r.titulo}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{r.texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* O painel por dentro — bloco escuro */}
      <section className="bg-ink py-20 text-ink-foreground md:py-28">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
          <Reveal>
            <span className="eyebrow text-ink-foreground/60">O painel por dentro</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Uma ferramenta de trabalho, não só uma vitrine
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-ink-foreground/70">
              Faturamento, pedidos e clientes num painel só — os mesmos números que a sua farmácia já
              acompanha, organizados.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <PainelPreview />
          </Reveal>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Reveal className="text-center">
            <span className="eyebrow justify-center">Planos</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Um plano pra cada tamanho de farmácia
            </h2>
          </Reveal>
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
            {Object.values(PLANS).map((plano, i) => {
              const destaque = plano.id === 'pro'
              return (
                <Reveal key={plano.id} delay={i * 0.08}>
                  <div
                    className={
                      destaque
                        ? 'relative h-full rounded-2xl border-2 border-brand bg-card p-6 shadow-brand'
                        : 'relative h-full rounded-2xl border border-border bg-card p-6 shadow-sm'
                    }
                  >
                    {destaque && (
                      <span className="absolute -top-3 left-6 rounded-full bg-violet px-3 py-1 text-xs font-semibold text-white">
                        Mais escolhido
                      </span>
                    )}
                    <h3 className="font-display text-lg font-bold">{plano.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{plano.description}</p>
                    <p className="mt-4 font-display text-3xl font-extrabold tabular-nums">
                      R$ {plano.priceMonthly.toFixed(2).replace('.', ',')}
                      <span className="text-sm font-medium text-muted-foreground"> /mês</span>
                    </p>
                    <ul className="mt-5 space-y-2">
                      {plano.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/cadastro"
                      className={
                        destaque
                          ? 'mt-6 block rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-brand transition hover:brightness-105'
                          : 'mt-6 block rounded-full border border-border px-5 py-2.5 text-center text-sm font-semibold transition hover:bg-accent'
                      }
                    >
                      Começar teste grátis
                    </Link>
                  </div>
                </Reveal>
              )
            })}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            14 dias grátis em qualquer plano · sem cartão · cancele quando quiser
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-secondary/40 py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <Reveal className="text-center">
            <span className="eyebrow justify-center">Perguntas frequentes</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              Antes de você perguntar
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10">
            <Accordion type="single" collapsible>
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="font-display text-base font-semibold">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* CTA final — bloco escuro com gradiente */}
      <section className="bg-ink py-20 text-ink-foreground md:py-28">
        <Reveal className="mx-auto max-w-2xl px-4 text-center md:px-6">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            Pronta pra parar de perder pedido no meio das conversas?
          </h2>
          <Link
            href="/cadastro"
            className="bg-gradient-brand mt-8 inline-block rounded-full px-8 py-3.5 font-semibold text-white shadow-brand transition hover:brightness-105 active:brightness-95"
          >
            Criar minha farmácia grátis
          </Link>
          <p className="mt-4 text-xs text-ink-foreground/50">14 dias grátis · sem cartão</p>
        </Reveal>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center md:flex-row md:justify-between md:px-6 md:text-left">
          <div className="flex items-center gap-2">
            <Smartphone className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} LeadFarma — catálogo online para farmácias.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/cadastro" className="hover:text-foreground">Criar farmácia</Link>
            <Link href="/painel/login" className="hover:text-foreground">Acessar painel</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
