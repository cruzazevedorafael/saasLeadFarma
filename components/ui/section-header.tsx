// components/ui/section-header.tsx
// Cabeçalho de seção premium: rótulo (eyebrow) + título + descrição opcional.
// Dá divisão clara e ritmo entre as áreas, sem poluir.
import { cn } from '@/lib/utils'

export function SectionHeader({
  label,
  title,
  description,
  action,
  className,
}: {
  label?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="space-y-1.5">
        {label && <span className="eyebrow">{label}</span>}
        <h2 className="font-display text-xl font-bold tracking-tight leading-none">{title}</h2>
        {description && <p className="text-sm text-muted-foreground max-w-prose">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
