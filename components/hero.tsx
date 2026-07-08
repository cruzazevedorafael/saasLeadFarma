'use client'

import { motion } from 'framer-motion'

export function Hero({ bannerImageUrl, storeName, logoUrl }: { bannerImageUrl?: string; storeName: string; logoUrl: string | null }) {
  const initial = (storeName || 'F').trim().charAt(0).toUpperCase()
  return (
    <section className="relative overflow-hidden py-8 md:py-16">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          transition={{ duration: 1 }}
          className="absolute -top-20 -right-20 md:-top-40 md:-right-40 h-40 w-40 md:h-80 md:w-80 rounded-full bg-[var(--brand)] blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute -bottom-20 -left-20 md:-bottom-40 md:-left-40 h-40 w-40 md:h-80 md:w-80 rounded-full bg-emerald-400 blur-3xl"
        />
      </div>

      <div className="container mx-auto px-3 md:px-4 relative">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="relative mb-4 md:mb-6"
          >
            <div className="relative h-20 w-20 md:h-28 md:w-28">
              <div className="absolute inset-0 rounded-full bg-[var(--brand)]/15 blur-xl" />
              <div className="relative h-full w-full rounded-full overflow-hidden border-4 border-[var(--brand)]/40 bg-[var(--brand)]/10 flex items-center justify-center">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={storeName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl md:text-4xl font-bold text-[var(--brand)]">{initial}</span>
                )}
              </div>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-2xl md:text-5xl font-bold tracking-tight text-balance text-foreground"
          >
            {storeName}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-2 md:mt-3 text-sm md:text-lg text-muted-foreground text-pretty"
          >
            Catálogo online · faça seu pedido pelo WhatsApp
          </motion.p>

          {bannerImageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 md:mt-10 w-full max-w-2xl px-1"
            >
              <div className="relative overflow-hidden rounded-xl md:rounded-2xl border border-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bannerImageUrl} alt="Destaque" className="block w-full object-cover" />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
