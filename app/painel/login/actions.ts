// app/painel/login/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
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
