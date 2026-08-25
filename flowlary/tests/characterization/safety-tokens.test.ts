/** Adapted from Lingo src/safety/safety.test.ts */
import { describe, expect, it } from 'vitest'
import { isExcludedHost, normalizeExcludedDomains } from '../../extension/src/core/safety/domains.ts'
import { isInsideMarkdownCode } from '../../extension/src/core/safety/markdown.ts'
import { skipReasonForToken } from '../../extension/src/core/safety/tokenKind.ts'
import { lastCompletedToken, tokenizeText } from '../../extension/src/core/safety/tokenize.ts'

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'

describe('characterization: token protection', () => {
  it('skips emails, urls, secrets, and cards', () => {
    expect(skipReasonForToken('test@example.com')).toBe('email')
    expect(skipReasonForToken('https://example.com')).toBe('url')
    expect(skipReasonForToken(JWT)).toBe('jwt')
    expect(skipReasonForToken('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe('api-key')
    expect(skipReasonForToken('4111 1111 1111 1111')).toBe('credit-card')
    expect(skipReasonForToken('MY_SECRET_TOKEN=abc123')).toBe('env-secret')
  })
})

describe('characterization: domains and markdown', () => {
  it('matches excluded hosts and subdomains without false positives', () => {
    const domains = normalizeExcludedDomains(['example.com'])
    expect(isExcludedHost('example.com', domains)).toBe(true)
    expect(isExcludedHost('sub.example.com', domains)).toBe(true)
    expect(isExcludedHost('notexample.com', domains)).toBe(false)
    expect(isExcludedHost('bank.example', domains)).toBe(false)
  })

  it('detects markdown code regions', () => {
    expect(isInsideMarkdownCode('```\nsecret', 8)).toBe(true)
    expect(isInsideMarkdownCode('hello `code', 11)).toBe(true)
    expect(isInsideMarkdownCode('hello world', 5)).toBe(false)
  })
})

describe('characterization: tokenizer', () => {
  it('tokenizes words and finds last completed token at boundary', () => {
    expect(tokenizeText("don't state-of-the-art").map((t) => t.token)).toEqual([
      "don't",
      'state-of-the-art',
    ])
    expect(lastCompletedToken('hello', 5, true)).toBeNull()
    expect(lastCompletedToken('hello ', 6, true)?.token).toBe('hello')
  })
})
