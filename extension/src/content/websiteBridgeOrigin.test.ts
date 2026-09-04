import { describe, expect, it } from 'vitest'
import { isWebsiteBridgeOriginAllowed } from './websiteBridgeOrigin.ts'

describe('isWebsiteBridgeOriginAllowed', () => {
  it('always allows flowlary.com', () => {
    expect(isWebsiteBridgeOriginAllowed('https://flowlary.com', false)).toBe(true)
    expect(isWebsiteBridgeOriginAllowed('https://www.flowlary.com', false)).toBe(true)
    expect(isWebsiteBridgeOriginAllowed('https://app.flowlary.com', true)).toBe(true)
  })

  it('allows flowlary.test for local API builds even when Vite DEV is false', () => {
    expect(isWebsiteBridgeOriginAllowed('https://flowlary.test', true)).toBe(true)
    expect(isWebsiteBridgeOriginAllowed('http://flowlary.test', true)).toBe(true)
    expect(isWebsiteBridgeOriginAllowed('https://www.flowlary.test', true)).toBe(true)
    expect(isWebsiteBridgeOriginAllowed('http://localhost:5173', true)).toBe(true)
    expect(isWebsiteBridgeOriginAllowed('http://127.0.0.1:4173', true)).toBe(true)
  })

  it('rejects local hosts on production API builds', () => {
    expect(isWebsiteBridgeOriginAllowed('https://flowlary.test', false)).toBe(false)
    expect(isWebsiteBridgeOriginAllowed('http://localhost:5173', false)).toBe(false)
    expect(isWebsiteBridgeOriginAllowed('https://evil.example', true)).toBe(false)
  })
})
