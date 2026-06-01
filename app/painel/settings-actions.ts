// app/painel/settings-actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function setWholesaleThreshold(value: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('não autenticado')
  const threshold = Math.max(1, Math.floor(Number(value) || 1))
  const db = createAdminClient()
  await db.from('store_settings').update({ wholesale_threshold: threshold, updated_at: new Date().toISOString() }).eq('id', 1)
  revalidatePath('/painel')
  revalidatePath('/')
}
