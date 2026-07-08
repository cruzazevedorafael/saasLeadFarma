'use client'

import { motion } from 'framer-motion'

export function Header({ storeName, logoUrl }: { storeName: string; logoUrl: string | null }) {
  const initial = (storeName || 'F').trim().charAt(0).toUpperCase()
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="container mx-auto flex h-12 md:h-16 items-center justify-between px-3 md:px-4">
        <motion.div
          className="flex items-center gap-2 md:gap-2.5"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <div className="relative h-9 w-9 md:h-11 md:w-11 shrink-0 overflow-hidden rounded-full border-2 border-[var(--brand)]/50 bg-[var(--brand)]/10 flex items-center justify-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-base md:text-lg font-bold text-[var(--brand)]">{initial}</span>
            )}
          </div>
          <span className="text-base md:text-xl font-bold tracking-tight text-foreground leading-none">
            {storeName}
          </span>
        </motion.div>

        <motion.div
          className="flex items-center gap-1.5 md:gap-2 rounded-full bg-[var(--brand)]/10 px-2.5 py-1.5 md:px-4 md:py-2 border border-[var(--brand)]/20"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-[var(--brand)] animate-pulse" />
          <span className="text-[10px] md:text-sm text-[var(--brand)]">Online</span>
        </motion.div>
      </div>
    </motion.header>
  )
}
