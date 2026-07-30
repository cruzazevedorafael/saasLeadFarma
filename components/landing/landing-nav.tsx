// components/landing/landing-nav.tsx
// Nav fixa: transparente sobre o hero escuro, vira sólida com blur ao rolar.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#recursos', label: 'Recursos' },
  { href: '#planos', label: 'Planos' },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-200',
        scrolled ? 'border-b border-white/10 bg-ink/90 backdrop-blur' : 'bg-transparent',
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4 md:px-6">
        <Logo size="md" className="text-ink-foreground" />

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-ink-foreground/75 transition hover:text-ink-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/painel/login"
            className="hidden text-sm font-medium text-ink-foreground/75 transition hover:text-ink-foreground sm:inline"
          >
            Entrar
          </Link>
          <Button asChild className="rounded-full">
            <Link href="/cadastro">Criar minha loja</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
