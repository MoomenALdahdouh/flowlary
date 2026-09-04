import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { FLOWLARY_API_TARGETS } from './src/config/apiTargets.ts'

const shared = new URL('../packages/shared/src', import.meta.url).pathname
const local = FLOWLARY_API_TARGETS.local

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_FLOWLARY_RELEASE': JSON.stringify('0'),
    'import.meta.env.VITE_FLOWLARY_API_TARGET': JSON.stringify('local'),
    'import.meta.env.VITE_FLOWLARY_API_URL': JSON.stringify(local.apiUrl),
    'import.meta.env.VITE_FLOWLARY_SITE_URL': JSON.stringify(local.siteUrl),
  },
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
