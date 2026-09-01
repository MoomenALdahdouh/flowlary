import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const shared = new URL('../../../packages/shared/src', import.meta.url).pathname

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('../../../extension/src', import.meta.url).pathname,
      '@flowlary/shared/tokens.css': `${shared}/tokens.css`,
      '@flowlary/shared/theme': `${shared}/theme.ts`,
      '@flowlary/shared': `${shared}/index.ts`,
    },
  },
  test: {
    root: new URL('.', import.meta.url).pathname,
    environment: 'happy-dom',
    fileParallelism: false,
    maxWorkers: 1,
    include: ['local-ai-model-selection.eval.test.ts'],
    testTimeout: 1_200_000,
    hookTimeout: 60_000,
    setupFiles: ['./local-ai-model-selection/setup.ts'],
  },
})
