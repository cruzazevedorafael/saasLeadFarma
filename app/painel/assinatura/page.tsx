// app/painel/assinatura/page.tsx — plano atual, período de teste e assinatura.
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { requirePharmacyAdmin, getCurrentPharmacy } from '@/lib/auth/guards'
import { planLabel, subscriptionLabel } from '@/lib/asaas/plans'
import { asaasEnabled } from '@/lib/asaas/client'
import { PlanoActions } from './_components/plano-actions'

export default async function AssinaturaPage() {
  await requirePharmacyAdmin({ skipOnboardingGate: true })
  const ph = await getCurrentPharmacy()

  const trialInfo = ph.plan === 'trial' && ph.trialEndsAt
    ? (() => {
        const dias = Math.ceil((new Date(ph.trialEndsAt!).getTime() - Date.now()) / 86400_000)
        return dias > 0 ? `Teste grátis — faltam ${dias} dia${dias !== 1 ? 's' : ''}.` : 'Seu período de teste terminou.'
      })()
    : null

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-2xl">
      <div>
        <BackButton href="/painel" label="Painel" />
        <h1 className="text-2xl font-bold">Assinatura</h1>
      </div>

      <div className="rounded-xl border border-border p-4 space-y-1">
        <p className="text-sm"><span className="text-muted-foreground">Plano atual:</span> <strong>{planLabel(ph.plan)}</strong></p>
        <p className="text-sm"><span className="text-muted-foreground">Status:</span> {subscriptionLabel(ph.subscriptionStatus)}</p>
        {trialInfo && <p className="text-sm text-brand">{trialInfo}</p>}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Escolha um plano</h2>
        <PlanoActions currentPlan={ph.plan} />
        {!asaasEnabled() && (
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            💳 A cobrança online (ASAAS) será ativada em breve. Durante o teste, tudo funciona normalmente —
            quando ativarmos, você poderá assinar por aqui (Pix, boleto ou cartão).
          </p>
        )}
      </div>
    </div>
  )
}
