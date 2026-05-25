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
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <motion.div 
          className="flex items-center gap-3"
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-[#CFFF04]/50">
            <Image
              src="/logo.jpeg"
              alt="KAROLLA FIT"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-foreground">
              KAROLLA <span className="text-[#CFFF04]">FIT</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Moda Fitness Atacado & Varejo
            </span>
          </div>
        </motion.div>
        
        <motion.div 
          className="hidden md:flex items-center gap-2 rounded-full bg-[#CFFF04]/10 px-4 py-2 border border-[#CFFF04]/20"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="h-2 w-2 rounded-full bg-[#CFFF04] animate-pulse" />
          <span className="text-sm text-[#CFFF04]">Catálogo Online</span>
        </motion.div>
      </div>
    </motion.header>
  )
}
