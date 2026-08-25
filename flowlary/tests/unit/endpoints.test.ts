import { describe, expect, it } from 'vitest'
import {
  LAYOUT_API_BASE,
  TRANSLATION_API_BASE,
} from '../../extension/src/config/endpoints.ts'

describe('API endpoints (dev import.meta.env.PROD=false in vitest)', () => {
  it('defaults to localhost in non-production test builds', () => {
    expect(TRANSLATION_API_BASE).toMatch(/^http:\/\/127\.0\.0\.1:8004/)
    expect(LAYOUT_API_BASE).toMatch(/^http:\/\/127\.0\.0\.1:8003/)
  })
})
