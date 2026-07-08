import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Use SOMENTE em código de servidor (server actions / route handlers). Nunca importar em client component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    // Erro claro (aparece nos logs da Vercel) quando falta configurar o ambiente.
    throw new Error(
      'Configuração do servidor ausente: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente (ex.: no painel da Vercel) e faça um novo deploy.'
    )
  }
  return createSupabaseClient(url, key, { auth: { persistSession: false } })
}
