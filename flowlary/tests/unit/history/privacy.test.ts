import { beforeEach, describe, expect, it } from 'vitest'
import {
  canRecordHistory,
  isSensitiveText,
  normalizeHistoryDomain,
} from '../../../extension/src/storage/history/privacy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'

function input(attrs: Record<string, string> = {}): HTMLInputElement {
  const el = document.createElement('input')
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'type') el.type = value
    else el.setAttribute(key, value)
  }
  document.body.append(el)
  return el
}

describe('history privacy gate', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    stateManager.settings.excludedDomains = []
  })

  it('blocks password fields', () => {
    const el = input({ type: 'password' })
    expect(canRecordHistory({ element: el, sourceText: 'hello', resultText: 'Hello' })).toBe(false)
  })

  it('blocks OTP fields', () => {
    const el = input({ type: 'text', autocomplete: 'one-time-code' })
    expect(canRecordHistory({ element: el, sourceText: '123456', resultText: '123457' })).toBe(false)
  })

  it('blocks payment fields', () => {
    const el = input({ type: 'text', name: 'cc-number' })
    expect(canRecordHistory({ element: el, sourceText: '4111', resultText: '4112' })).toBe(false)
  })

  it('blocks API key text', () => {
    const el = document.createElement('textarea')
    document.body.append(el)
    expect(isSensitiveText('gsk_123456789012345678901234567890')).toBe(true)
    expect(canRecordHistory({ element: el, sourceText: 'gsk_123456789012345678901234567890', resultText: 'safe' })).toBe(false)
  })

  it('blocks JWT text', () => {
    const el = document.createElement('textarea')
    document.body.append(el)
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'
    expect(isSensitiveText(jwt)).toBe(true)
  })

  it('blocks code editor fields', () => {
    const host = document.createElement('div')
    host.className = 'monaco-editor'
    const el = document.createElement('textarea')
    host.append(el)
    document.body.append(host)
    expect(canRecordHistory({ element: el, sourceText: 'const x = 1', resultText: 'const x = 2' })).toBe(false)
  })

  it('blocks markdown code regions', () => {
    const el = document.createElement('textarea')
    document.body.append(el)
    const code = '```\nsecret\n```'
    expect(canRecordHistory({ element: el, sourceText: code, resultText: '```\npublic\n```' })).toBe(false)
  })

  it('blocks excluded domains', () => {
    const el = document.createElement('textarea')
    document.body.append(el)
    stateManager.settings.excludedDomains = ['blocked.example']
    expect(
      canRecordHistory({
        element: el,
        hostname: 'blocked.example',
        excludedDomains: stateManager.settings.excludedDomains,
        sourceText: 'hello',
        resultText: 'Hello',
      }),
    ).toBe(false)
  })

  it('normalizes domain to hostname only', () => {
    expect(normalizeHistoryDomain('WWW.Example.COM')).toBe('example.com')
    expect(normalizeHistoryDomain('')).toBeUndefined()
  })
})
