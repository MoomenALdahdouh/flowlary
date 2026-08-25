import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['../tests/integration/phase16-ai-gateway.test.ts', '../tests/unit/ai/**/*.test.ts'],
    environment: 'node',
  },
})
