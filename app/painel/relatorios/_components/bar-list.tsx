// Barras simples (sem lib de gráfico) — leve e suficiente para os relatórios.
import type { Bucket } from '@/lib/data/analytics.helpers'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export function BarList({ data, metric = 'receita' }: { data: Bucket[]; metric?: 'receita' | 'pedidos' }) {
  const max = Math.max(1, ...data.map((d) => (metric === 'receita' ? d.receita : d.pedidos)))
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const val = metric === 'receita' ? d.receita : d.pedidos
        return (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0 text-muted-foreground truncate">{d.label}</span>
            <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
              <div className="h-full rounded bg-[#F97316]" style={{ width: `${(val / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right tabular-nums">
              {metric === 'receita' ? brl(d.receita) : `${d.pedidos} ped.`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
