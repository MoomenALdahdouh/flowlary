import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const shared = new URL('../packages/shared/src', import.meta.url).pathname

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@flowlary/shared/tokens.css': `${shared}/tokens.css`,
      '@flowlary/shared/theme': `${shared}/theme.ts`,
      '@flowlary/shared': `${shared}/index.ts`,
      '@flowlary/layout-repair': new URL('../extension/src/core/engine/layoutSequence.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
