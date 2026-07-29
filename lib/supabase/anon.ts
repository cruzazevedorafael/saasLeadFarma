import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Client ANÔNIMO, SEM cookies — só para as leituras PÚBLICAS do catálogo (/f/[slug]).
// Por não ler cookies(), a página do catálogo deixa de ser dinâmica e pode ser
// renderizada estaticamente (ISR + CDN), o que deixa a superfície mais acessada do
// produto rápida e barata (servida da borda, não de uma função a cada acesso).
//
// Enxerga EXATAMENTE o que o papel `anon` já via (RLS + views public_*): é o mesmo
// dado que o visitante deslogado sempre viu. NUNCA usar para escrita nem para dados
// do painel — para isso continua valendo o client autenticado (server.ts) ou o
// service_role (admin.ts).
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
