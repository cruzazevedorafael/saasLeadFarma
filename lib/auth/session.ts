// lib/auth/session.ts
// Sessão + papel do usuário logado (server-side).
import { createClient } from '@/lib/supabase/server'

export type Role = 'superadmin' | 'pharmacy_admin'

export interface SessionProfile {
  userId: string
  role: Role
  pharmacyId: string | null
}

/** Lê o usuário autenticado e seu profile (papel + farmácia). null se não logado. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('role, pharmacy_id')
    .eq('id', user.id)
    .single()
  if (error || !data) return null
  return { userId: user.id, role: data.role as Role, pharmacyId: data.pharmacy_id ?? null }
}
