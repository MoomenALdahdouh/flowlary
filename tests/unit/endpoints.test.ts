import { describe, expect, it } from 'vitest'
import {
  FLOWLARY_API_BASE,
  LAYOUT_API_BASE,
  TRANSLATION_API_BASE,
} from '../../extension/src/config/endpoints.ts'

describe('API endpoints (dev import.meta.env.PROD=false in vitest)', () => {
  it('defaults to unified localhost API in non-production test builds', () => {
    expect(FLOWLARY_API_BASE).toMatch(/^http:\/\/127\.0\.0\.1:8787/)
    expect(TRANSLATION_API_BASE).toBe(FLOWLARY_API_BASE)
    expect(LAYOUT_API_BASE).toBe(FLOWLARY_API_BASE)
  })
})
