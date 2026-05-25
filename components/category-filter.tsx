'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { categories } from '@/lib/products'

interface CategoryFilterProps {
  selectedCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryFilter({ selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full overflow-x-auto pb-2 scrollbar-hide"
    >
      <div className="flex gap-2 min-w-max px-4 md:px-0 md:justify-center">
        {categories.map((category, index) => (
          <motion.button
            key={category}
            onClick={() => onSelectCategory(category)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'bg-[#CFFF04] text-black'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {category}
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
