// app/painel/financeiro/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMonthlySummary } from '@/lib/data/finance'
import { VendasChart } from './_components/vendas-chart'

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const sp = await searchParams
  const now = new Date()
  const year = Number(sp.y) || now.getUTCFullYear()
  const month = Number(sp.m) || now.getUTCMonth() + 1 // 1-12

  const sum = await getMonthlySummary(year, month)

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Link href="/painel" className="text-sm text-muted-foreground hover:underline">← Painel</Link>
        <h1 className="text-2xl font-bold">Financeiro</h1>
      </div>

      <div className="flex items-center gap-4">
        <Link href={`/painel/financeiro?y=${prev.y}&m=${prev.m}`} className="px-3 py-1 rounded bg-muted hover:bg-muted/80 text-sm">←</Link>
        <span className="font-medium">{MESES[month - 1]} / {year}</span>
        <Link href={`/painel/financeiro?y=${next.y}&m=${next.m}`} className="px-3 py-1 rounded bg-muted hover:bg-muted/80 text-sm">→</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Vendas</p>
          <p className="text-2xl font-bold">{fmt(sum.revenue)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Custo</p>
          <p className="text-2xl font-bold">{fmt(sum.cost)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Lucro</p>
          <p className="text-2xl font-bold text-[#9bbf00]">{fmt(sum.profit)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O lucro depende do <strong>custo</strong> preenchido no cadastro de cada produto.
      </p>

      <VendasChart data={sum.byDay} />
    </div>
  )
}
