'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const PRESETS: { key: string; label: string }[] = [
  { key: 'dia', label: 'Hoje' },
  { key: 'semana', label: '7 dias' },
  { key: 'mes', label: '30 dias' },
  { key: 'ano', label: '12 meses' },
]

export function RangeFilter({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [custom, setCustom] = useState(false)
  const [from, setFrom] = useState(sp.get('from') ?? '')
  const [to, setTo] = useState(sp.get('to') ?? '')

  const go = (range: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    params.set('range', range)
    if (extra) for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setCustom(false); go(p.key) }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              current === p.key && !custom ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setCustom((v) => !v)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            current === 'custom' || custom ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Período
        </button>
      </div>

      {(custom || current === 'custom') && (
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm shadow-sm" />
          <span className="text-muted-foreground text-sm">até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm shadow-sm" />
          <button
            onClick={() => go('custom', { from, to })}
            disabled={!from || !to}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}
