import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Ignora os worktrees do Claude (ex.: .claude/worktrees/bloco3-assinatura) — são
    // branches em andamento com o próprio harness de teste; não fazem parte da raiz.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
