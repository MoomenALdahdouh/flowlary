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
    },
  },
  test: {
    globalSetup: ['./vitest.globalSetup.ts'],
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      '../tests/unit/**/*.test.ts',
      '../tests/unit/**/*.test.tsx',
      '../tests/integration/**/*.test.ts',
      '../tests/integration/**/*.test.tsx',
      '../tests/characterization/**/*.test.ts',
    ],
    // Live/evaluation harnesses are never part of normal tests. Run them only
    // with their dedicated config and explicit provider flag.
    exclude: ['../tests/**/*.eval.test.ts'],
  },
})
