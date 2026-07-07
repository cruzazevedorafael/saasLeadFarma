// lib/auth/guards.ts
// Guards por papel para Server Components / Server Actions.
import { redirect } from 'next/navigation'
import { getSessionProfile, type SessionProfile } from './session'
import { getPharmacyById, type Pharmacy } from '@/lib/data/pharmacy'

/** Exige super-admin. Redireciona para o login caso contrário. */
export async function requireSuperadmin(): Promise<SessionProfile> {
  const profile = await getSessionProfile()
  if (!profile || profile.role !== 'superadmin') redirect('/painel/login')
  return profile!
}

/**
 * Exige admin de farmácia. Super-admin é mandado para /gestao.
 * Se o onboarding não estiver completo, manda para /painel/cadastro.
 */
export async function requirePharmacyAdmin(opts?: { skipOnboardingGate?: boolean }): Promise<SessionProfile> {
  const profile = await getSessionProfile()
  if (!profile) redirect('/painel/login')
  if (profile!.role === 'superadmin') redirect('/gestao')
  if (profile!.role !== 'pharmacy_admin' || !profile!.pharmacyId) redirect('/painel/login')
  if (!opts?.skipOnboardingGate) {
    const ph = await getPharmacyById(profile!.pharmacyId!)
    if (!ph || !ph.onboardingCompleted) redirect('/painel/cadastro')
  }
  return profile!
}

/** Farmácia do usuário logado (pharmacy_admin). Redireciona se não houver. */
export async function getCurrentPharmacy(): Promise<Pharmacy> {
  const profile = await getSessionProfile()
  if (!profile?.pharmacyId) redirect('/painel/login')
  const ph = await getPharmacyById(profile!.pharmacyId!)
  if (!ph) redirect('/painel/login')
  return ph
}

/** Id da farmácia corrente, para setar pharmacy_id em inserts. */
export async function getCurrentPharmacyId(): Promise<string> {
  const profile = await getSessionProfile()
  if (!profile?.pharmacyId) redirect('/painel/login')
  return profile!.pharmacyId!
}
