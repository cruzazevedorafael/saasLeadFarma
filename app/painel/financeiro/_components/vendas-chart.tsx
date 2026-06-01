// app/painel/financeiro/_components/vendas-chart.tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function VendasChart({ data }: { data: { day: number; revenue: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">Sem vendas baixadas neste mês.</p>
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" tickFormatter={(d) => `${d}`} fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`} labelFormatter={(d) => `Dia ${d}`} />
          <Bar dataKey="revenue" fill="#CFFF04" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
