// components/landing/hero-mockup.tsx
// Mockup do catálogo construído em código (sem imagem gerada): cartão de loja +
// notificação de pedido chegando pelo WhatsApp. Entra uma vez, com leve mola, e para.
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

const PRODUTOS = [
  { nome: 'Dipirona 500mg', preco: 'R$ 12,90' },
  { nome: 'Vitamina C 1g', preco: 'R$ 24,50' },
  { nome: 'Protetor solar FPS 60', preco: 'R$ 52,90' },
]

export function HeroMockup() {
  const reduce = useReducedMotion()

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="bg-gradient-brand px-5 py-4">
          <p className="text-xs font-semibold text-white/85">Farmácia Bem-Estar</p>
          <div className="mt-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white/90">
            Buscar produto…
          </div>
        </div>
        <div className="divide-y divide-border">
          {PRODUTOS.map((p) => (
            <div key={p.nome} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-foreground/90">{p.nome}</span>
              <span className="font-display font-semibold tabular-nums text-foreground">{p.preco}</span>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16, x: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 18, delay: 0.6 }}
        className="absolute -bottom-6 -right-3 w-56 rounded-2xl border border-border bg-card p-3 shadow-lg sm:-right-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Novo pedido recebido</p>
            <p className="truncate text-[11px] text-muted-foreground">via WhatsApp · R$ 89,80</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
