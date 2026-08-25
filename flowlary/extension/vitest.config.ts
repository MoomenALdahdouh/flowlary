import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      '../tests/unit/**/*.test.ts',
      '../tests/integration/**/*.test.ts',
      '../tests/characterization/**/*.test.ts',
    ],
  },
})
