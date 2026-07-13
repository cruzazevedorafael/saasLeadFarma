import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const path = request.nextUrl.pathname
  const isLogin = path === '/painel/login'
  const { data: { user } } = await supabase.auth.getUser()

  const redirectTo = (to: string) => NextResponse.redirect(new URL(to, request.url))

  // Não logado
  if (!user) {
    if (path.startsWith('/gestao')) return redirectTo('/painel/login')
    if (path.startsWith('/painel') && !isLogin) return redirectTo('/painel/login')
    return response
  }

  // Logado: descobre papel
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, pharmacy_id')
    .eq('id', user.id)
    .single()
  const role = profile?.role as 'superadmin' | 'pharmacy_admin' | undefined

  // Área de gestão: só super-admin
  if (path.startsWith('/gestao')) {
    if (role !== 'superadmin') return redirectTo('/painel')
    return response
  }

  // Área do painel da farmácia
  if (path.startsWith('/painel')) {
    if (role === 'superadmin') return redirectTo('/gestao')
    if (role !== 'pharmacy_admin') {
      if (!isLogin) return redirectTo('/painel/login')
      return response
    }
    // status + onboarding numa query só
    let suspended = false
    let onboardingDone = true
    if (profile?.pharmacy_id) {
      const { data: ph } = await supabase
        .from('pharmacies')
        .select('status, onboarding_completed')
        .eq('id', profile.pharmacy_id)
        .single()
      suspended = ph?.status === 'suspended'
      onboardingDone = !!ph?.onboarding_completed
    }
    // Farmácia suspensa: bloqueia o painel; só deixa ver a tela de login (com aviso).
    if (suspended) return isLogin ? response : redirectTo('/painel/login?suspensa=1')
    // logado tentando abrir a tela de login → manda pro painel
    if (isLogin) return redirectTo('/painel')
    // gate de onboarding
    if (path !== '/painel/cadastro' && !onboardingDone) return redirectTo('/painel/cadastro')
  }

  return response
}

export const config = {
  matcher: ['/painel/:path*', '/gestao/:path*'],
}
