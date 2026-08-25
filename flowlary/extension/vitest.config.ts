import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      '../tests/unit/**/*.test.ts',
      '../tests/unit/**/*.test.tsx',
      '../tests/integration/**/*.test.ts',
      '../tests/integration/**/*.test.tsx',
      '../tests/characterization/**/*.test.ts',
    ],
  },
})
