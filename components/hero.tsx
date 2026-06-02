'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export function Hero({ bannerImageUrl }: { bannerImageUrl?: string }) {
  return (
    <section className="relative overflow-hidden py-8 md:py-24">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1 }}
          className="absolute -top-20 -right-20 md:-top-40 md:-right-40 h-40 w-40 md:h-80 md:w-80 rounded-full bg-[#CFFF04] blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute -bottom-20 -left-20 md:-bottom-40 md:-left-40 h-40 w-40 md:h-80 md:w-80 rounded-full bg-[#CFFF04] blur-3xl"
        />
      </div>

      <div className="container mx-auto px-3 md:px-4 relative">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="relative mb-4 md:mb-8"
          >
            <div className="relative h-24 w-24 md:h-40 md:w-40">
              <div className="absolute inset-0 rounded-full bg-[#CFFF04]/20 animate-pulse" />
              <div className="absolute inset-2 rounded-full overflow-hidden border-4 border-[#CFFF04]/50 bg-background">
                <Image
                  src="/logo.jpeg"
                  alt="KAROLLA FIT"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-[#CFFF04]/30 blur-2xl -z-10" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-3xl md:text-6xl font-bold tracking-tight text-balance"
          >
            <span className="text-foreground">KAROLLA</span>{' '}
            <span className="text-[#CFFF04]">FIT</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-2 md:mt-4 text-base md:text-xl text-muted-foreground text-pretty"
          >
            Moda Fitness de Qualidade
          </motion.p>

          {/* Price Types */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-4 md:mt-8 flex flex-wrap justify-center gap-2 md:gap-4"
          >
            <div className="flex items-center gap-2 md:gap-3 rounded-full bg-muted/50 px-4 py-2 md:px-6 md:py-3 border border-border/50">
              <div className="h-2 w-2 md:h-3 md:w-3 rounded-full bg-foreground" />
              <span className="text-xs md:text-sm font-medium">Preco Varejo</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3 rounded-full bg-[#CFFF04]/10 px-4 py-2 md:px-6 md:py-3 border border-[#CFFF04]/30">
              <div className="h-2 w-2 md:h-3 md:w-3 rounded-full bg-[#CFFF04]" />
              <span className="text-xs md:text-sm font-medium text-[#CFFF04]">Preco Atacado</span>
            </div>
          </motion.div>

          {/* Banner de Promocoes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-6 md:mt-12 w-full max-w-2xl px-1"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 20px rgba(207, 255, 4, 0.3)',
                  '0 0 40px rgba(207, 255, 4, 0.5)',
                  '0 0 20px rgba(207, 255, 4, 0.3)'
                ]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-r from-[#CFFF04] via-[#e8ff66] to-[#CFFF04] p-[2px]"
            >
              {bannerImageUrl ? (
                <img
                  src={bannerImageUrl}
                  alt="Oferta"
                  className="block w-full rounded-[10px] md:rounded-[14px] object-cover"
                />
              ) : (
              <div className="relative rounded-xl md:rounded-2xl bg-background/95 backdrop-blur-sm px-4 py-4 md:px-8 md:py-6">
                {/* Estrelas decorativas */}
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                  className="absolute top-2 left-3 md:top-3 md:left-4 text-[#CFFF04] text-sm md:text-lg"
                >
                  ✦
                </motion.span>
                <motion.span
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                  className="absolute top-2 right-3 md:top-3 md:right-4 text-[#CFFF04] text-sm md:text-lg"
                >
                  ✦
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute bottom-2 left-1/4 md:bottom-3 text-[#CFFF04]/60 text-xs md:text-sm"
                >
                  ★
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                  className="absolute bottom-2 right-1/4 md:bottom-3 text-[#CFFF04]/60 text-xs md:text-sm"
                >
                  ★
                </motion.span>

                {/* Conteudo do banner */}
                <div className="flex flex-col items-center gap-1.5 md:gap-2">
                  <motion.span
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="inline-block px-2.5 py-0.5 md:px-3 md:py-1 rounded-full bg-[#CFFF04] text-black text-[10px] md:text-xs font-bold uppercase tracking-wider"
                  >
                    Oferta Especial
                  </motion.span>
                  <h3 className="text-base md:text-2xl font-bold text-foreground text-center">
                    Compre 5 Pecas e Ganhe{' '}
                    <span className="text-[#CFFF04]">10% OFF</span>
                  </h3>
                  <p className="text-muted-foreground text-[10px] md:text-sm text-center">
                    Valido para atacado • Frete gratis acima de R$300
                  </p>
                </div>
              </div>
              )}
            </motion.div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 md:mt-12"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex flex-col items-center gap-2 text-muted-foreground"
            >
              <span className="text-xs uppercase tracking-widest">Veja os Produtos</span>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
