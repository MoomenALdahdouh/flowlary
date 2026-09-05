import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      '../tests/integration/phase16-ai-gateway.test.ts',
      '../tests/integration/ai-provider-fallback.test.ts',
      '../tests/integration/phase17-account.test.ts',
      '../tests/integration/phase20-billing.test.ts',
      '../tests/integration/password-reset.test.ts',
      '../tests/integration/reliability.test.ts',
      '../tests/integration/feedback-voc.test.ts',
      '../tests/integration/phase2-trust-stats.test.ts',
      '../tests/integration/admin-panel.test.ts',
      '../tests/integration/phase3-support.test.ts',
      '../tests/unit/ai/**/*.test.ts',
      '../tests/unit/backend/**/*.test.ts',
    ],
    environment: 'node',
  },
})
