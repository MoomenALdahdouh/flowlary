import { describe, expect, it } from 'vitest'
import {
  FLOWLARY_API_BASE,
  FLOWLARY_SITE_URL,
  LAYOUT_API_BASE,
  LOCAL_DEV_API_BASE,
  TRANSLATION_API_BASE,
} from '../../extension/src/config/endpoints.ts'

describe('API endpoints (vitest injects the local API target)', () => {
  it('defaults to the local Node gateway', () => {
    expect(LOCAL_DEV_API_BASE).toBe('http://127.0.0.1:8787')
    expect(FLOWLARY_API_BASE).toBe(LOCAL_DEV_API_BASE)
    expect(TRANSLATION_API_BASE).toBe(FLOWLARY_API_BASE)
    expect(LAYOUT_API_BASE).toBe(FLOWLARY_API_BASE)
  })

  it('defaults to flowlary.test for local website links', () => {
    expect(FLOWLARY_SITE_URL).toBe('https://flowlary.test')
  })
})
