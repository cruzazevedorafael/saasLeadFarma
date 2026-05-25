'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

export function Header() {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl"
    >
      <div className="container mx-auto flex h-12 md:h-16 items-center justify-between px-3 md:px-4">
        <motion.div
          className="flex items-center gap-2 md:gap-2.5"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <div className="relative h-9 w-9 md:h-11 md:w-11 shrink-0 overflow-hidden rounded-full border-2 border-[#CFFF04]/50">
            <Image
              src="/logo.jpeg"
              alt="KAROLLA FIT"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base md:text-xl font-bold tracking-tight text-foreground leading-none">
              KAROLLA <span className="text-[#CFFF04]">FIT</span>
            </span>
            <span className="hidden sm:inline text-[10px] md:text-xs text-muted-foreground leading-none">
              · Atacado & Varejo
            </span>
          </div>
        </motion.div>
        
        <motion.div 
          className="flex items-center gap-1.5 md:gap-2 rounded-full bg-[#CFFF04]/10 px-2.5 py-1.5 md:px-4 md:py-2 border border-[#CFFF04]/20"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-[#CFFF04] animate-pulse" />
          <span className="text-[10px] md:text-sm text-[#CFFF04]">Online</span>
        </motion.div>
      </div>
    </motion.header>
  )
}
