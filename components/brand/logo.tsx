// components/brand/logo.tsx
// Marca do LeadFarma. SVG inline (leve, nítido em qualquer tamanho, temável).
// <LogoMark/> = só o símbolo · <Logo/> = símbolo + wordmark.
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { box: 24, radius: 7, text: 'text-base' },
  md: { box: 32, radius: 9, text: 'text-lg' },
  lg: { box: 40, radius: 11, text: 'text-xl' },
  xl: { box: 56, radius: 15, text: 'text-3xl' },
} as const

type Size = keyof typeof SIZES

/** Símbolo: quadrado arredondado laranja com uma cruz de farmácia + gota (marca). */
export function LogoMark({ size = 'md', className }: { size?: Size; className?: string }) {
  const { box, radius } = SIZES[size]
  return (
    <svg
      width={box}
      height={box}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx={radius * (40 / box)} fill="var(--brand)" />
      {/* cruz de farmácia, vazada em branco */}
      <path
        d="M17 9.5a3 3 0 0 1 6 0V17h7.5a3 3 0 0 1 0 6H23v7.5a3 3 0 0 1-6 0V23H9.5a3 3 0 0 1 0-6H17V9.5Z"
        fill="var(--brand-contrast)"
      />
    </svg>
  )
}

/** Marca completa: símbolo + "LeadFarma". */
export function Logo({
  size = 'md',
  showWordmark = true,
  className,
}: {
  size?: Size
  showWordmark?: boolean
  className?: string
}) {
  const { text } = SIZES[size]
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className={cn('font-display font-extrabold tracking-tight leading-none', text)}>
          Lead<span className="text-brand">Farma</span>
        </span>
      )}
    </span>
  )
}
