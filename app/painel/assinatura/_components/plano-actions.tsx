'use client'

import { useState } from 'react'
import { assinarPlano } from '../actions'
import { PLANS } from '@/lib/asaas/plans'
import { Button } from '@/components/ui/button'

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

export function PlanoActions({ currentPlan }: { currentPlan: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const escolher = async (plan: 'basic' | 'pro') => {
    setBusy(plan); setMsg(null); setLink(null)
    try {
      const r = await assinarPlano(plan)
      if (!r.ok) setMsg(r.error ?? 'Não foi possível assinar agora.')
      else if (r.invoiceUrl) setLink(r.invoiceUrl)
      else setMsg('Assinatura criada! Em breve você recebe a cobrança.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.values(PLANS).map((p) => (
          <div key={p.id} className={`rounded-xl border p-4 ${currentPlan === p.id ? 'border-[#F97316] bg-[#F97316]/5' : 'border-border'}`}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{p.name}</h3>
              <span className="text-sm font-bold text-[#F97316]">{brl(p.priceMonthly)}<span className="text-xs font-normal text-muted-foreground">/mês</span></span>
            </div>
            <ul className="mt-2 mb-3 space-y-1 text-xs text-muted-foreground">
              {p.features.map((f) => <li key={f}>• {f}</li>)}
            </ul>
            <Button
              type="button" size="sm" className="w-full"
              variant={currentPlan === p.id ? 'outline' : 'default'}
              disabled={busy === p.id || currentPlan === p.id}
              onClick={() => escolher(p.id as 'basic' | 'pro')}
            >
              {currentPlan === p.id ? 'Plano atual' : busy === p.id ? 'Processando...' : 'Assinar'}
            </Button>
          </div>
        ))}
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-black">
          Pagar agora →
        </a>
      )}
    </div>
  )
}
