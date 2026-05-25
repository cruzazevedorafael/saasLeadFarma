'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export function Hero() {
  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1 }}
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#CFFF04] blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#CFFF04] blur-3xl"
        />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="relative mb-8"
          >
            <div className="relative h-32 w-32 md:h-40 md:w-40">
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
            className="text-4xl md:text-6xl font-bold tracking-tight text-balance"
          >
            <span className="text-foreground">KAROLLA</span>{' '}
            <span className="text-[#CFFF04]">FIT</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-4 text-lg md:text-xl text-muted-foreground text-pretty"
          >
            Moda Fitness de Qualidade
          </motion.p>

          {/* Price Types */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-wrap justify-center gap-4"
          >
            <div className="flex items-center gap-3 rounded-full bg-muted/50 px-6 py-3 border border-border/50">
              <div className="h-3 w-3 rounded-full bg-foreground" />
              <span className="text-sm font-medium">Preço Varejo</span>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-[#CFFF04]/10 px-6 py-3 border border-[#CFFF04]/30">
              <div className="h-3 w-3 rounded-full bg-[#CFFF04]" />
              <span className="text-sm font-medium text-[#CFFF04]">Preço Atacado</span>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 grid grid-cols-3 gap-8 md:gap-16"
          >
            {[
              { value: '500+', label: 'Clientes' },
              { value: '50+', label: 'Produtos' },
              { value: '24h', label: 'Entrega' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl md:text-3xl font-bold text-[#CFFF04]">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-12"
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
