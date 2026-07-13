// components/ui/metric-card.tsx
// Card de métrica (KPI). Reutilizável em gestão e relatórios.
// Se `href` for passado, vira clicável (drill-down).
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

export function MetricCard({
  label,
  value,
  hint,
  icon,
  href,
  accent,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  href?: string
  accent?: boolean
  className?: string
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon && <span className={cn('text-muted-foreground', accent && 'text-brand')}>{icon}</span>}
        {href && !icon && <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
      </div>
      <div className={cn('mt-2 font-display text-2xl font-bold tracking-tight tabular-nums', accent && 'text-brand')}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </>
  )

  const base = cn(
    'rounded-xl border border-border bg-card p-4 shadow-sm',
    href && 'group transition-all hover:border-brand/50 hover:shadow-md hover:-translate-y-0.5',
    className,
  )

  return href ? <Link href={href} className={base}>{inner}</Link> : <div className={base}>{inner}</div>
}
