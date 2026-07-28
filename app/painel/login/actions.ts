// app/painel/login/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'

export async function login(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))

  const ip = await getClientIp()
  // Duas camadas: `login` (por ip:email) impede força-bruta numa conta
  // específica; `loginIp` (só por ip, mais largo) impede password spraying
  // contra várias contas diferentes a partir do mesmo IP. As duas precisam
  // passar.
  const rlIp = await checkRateLimit('loginIp', ip)
  const rl = await checkRateLimit('login', `${ip}:${email}`)
  if (!rlIp.ok || !rl.ok) redirect('/painel/login?erro=limite')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/painel/login?erro=1')
  redirect('/painel')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/painel/login')
}
