// components/landing/painel-preview.tsx
// Prévia do painel construída em código (não é screenshot) — mesma linguagem visual
// dos KPIs reais (ver components/ui/metric-card.tsx), sobre o bloco escuro-âncora.
import { TrendingUp, Package, Users } from 'lucide-react'

const KPIS = [
  { label: 'Faturamento no mês', value: 'R$ 8.420', icon: TrendingUp },
  { label: 'Pedidos', value: '132', icon: Package },
  { label: 'Clientes ativos', value: '87', icon: Users },
]

export function PainelPreview() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
      {KPIS.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Icon className="size-4" />
          </span>
          <p className="mt-3 text-xs text-white/60">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">{value}</p>
        </div>
      ))}
    </div>
  )
}
