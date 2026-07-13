// components/ui/back-button.tsx — botão de retorno padrão (alvo de toque decente).
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackButton({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent hover:border-brand/40',
        className,
      )}
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}
