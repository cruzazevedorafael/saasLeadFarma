'use server'
import { requirePharmacyAdmin, getCurrentPharmacyId } from '@/lib/auth/guards'
import { subscribePharmacy } from '@/lib/asaas/billing'
import { revalidatePath } from 'next/cache'

export async function assinarPlano(plan: 'basic' | 'pro'): Promise<{ ok: boolean; error?: string; invoiceUrl?: string }> {
  await requirePharmacyAdmin({ skipOnboardingGate: true })
  const pharmacyId = await getCurrentPharmacyId()
  const r = await subscribePharmacy(pharmacyId, plan)
  revalidatePath('/painel/assinatura')
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, invoiceUrl: r.invoiceUrl }
}
