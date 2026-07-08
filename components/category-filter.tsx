'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
interface CategoryFilterProps {
  categories: string[]
  selectedCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0"
    >
      <div className="flex gap-1.5 md:gap-2 min-w-max md:justify-center">
        {categories.map((category, index) => (
          <motion.button
            key={category}
            onClick={() => onSelectCategory(category)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === category
                ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
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
