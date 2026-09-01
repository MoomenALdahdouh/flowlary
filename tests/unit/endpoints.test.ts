import { describe, expect, it } from 'vitest'
import {
  FLOWLARY_API_BASE,
  FLOWLARY_SITE_URL,
  LAYOUT_API_BASE,
  LOCAL_DEV_API_BASE,
  TRANSLATION_API_BASE,
} from '../../extension/src/config/endpoints.ts'

describe('API endpoints (dev import.meta.env.PROD=false in vitest)', () => {
  it('defaults to Herd local API in non-production test builds', () => {
    expect(LOCAL_DEV_API_BASE).toBe('https://writing-api.test')
    expect(FLOWLARY_API_BASE).toBe(LOCAL_DEV_API_BASE)
    expect(TRANSLATION_API_BASE).toBe(FLOWLARY_API_BASE)
    expect(LAYOUT_API_BASE).toBe(FLOWLARY_API_BASE)
  })

  it('defaults to flowlary.test for local website links', () => {
    expect(FLOWLARY_SITE_URL).toBe('https://flowlary.test')
  })
})
