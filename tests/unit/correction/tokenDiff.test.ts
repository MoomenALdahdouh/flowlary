import { describe, expect, it } from 'vitest'
import {
  buildHighlightedTokens,
  buildHistoryDiffTokens,
  diffCharacters,
  markedText,
  tokenize,
} from '../../../extension/src/features/correction/diff/tokenDiff.ts'

describe('token diff', () => {
  it('tokenizes words and punctuation', () => {
    expect(tokenize('I recieve.')).toEqual(['I', ' ', 'recieve', '.'])
  })

  it('colors only the inserted letter in recive → receive', () => {
    const tokens = buildHighlightedTokens('I recive', 'I receive', [
      { type: 'spelling', original: 'recive', corrected: 'receive', start: 2, end: 8 },
    ])
    expect(tokens.map((t) => t.value).join('')).toBe('I receive')
    expect(markedText(tokens)).toBe('e')
    expect(tokens.find((t) => t.type !== 'equal')?.changeType).toBe('spelling')
  })

  it('history diff keeps wrongs and fixes for yuo → you', () => {
    const tokens = buildHistoryDiffTokens('hell hwo are yuo', 'hello how are you')
    const deletes = tokens.filter((t) => t.type === 'delete').map((t) => t.value)
    const inserts = tokens.filter((t) => t.type === 'insert').map((t) => t.value)
    expect(deletes).toEqual(expect.arrayContaining(['hell', 'hwo', 'yuo']))
    expect(inserts).toEqual(expect.arrayContaining(['hello', 'how', 'you']))
  })

  it('history diff marks grammar punctuation inserts', () => {
    const tokens = buildHistoryDiffTokens(
      'hello how are you what you needs',
      'Hello, how are you? What do you need?',
    )
    expect(tokens.some((t) => t.type === 'insert')).toBe(true)
    expect(tokens.filter((t) => t.type !== 'equal').length).toBeGreaterThan(2)
  })

  it('colors only the added letters in you → your and emai → email', () => {
    const tokens = buildHighlightedTokens(
      'I recive you emai',
      'I receive your email',
      [
        { type: 'spelling', original: 'recive', corrected: 'receive', start: 2, end: 8 },
        { type: 'grammar', original: 'you', corrected: 'your', start: 9, end: 12 },
        { type: 'spelling', original: 'emai', corrected: 'email', start: 13, end: 17 },
      ],
    )
    expect(tokens.map((t) => t.value).join('')).toBe('I receive your email')
    const marked = tokens.filter((t) => t.type !== 'equal')
    expect(marked.map((t) => t.value)).toEqual(['e', 'r', 'l'])
    expect(marked.map((t) => t.changeType)).toEqual(['spelling', 'grammar', 'spelling'])
  })

  it('marks a fully replaced word when letters do not overlap', () => {
    const tokens = diffCharacters('go', 'went', 'grammar')
    expect(tokens.map((t) => t.value).join('')).toBe('went')
    expect(markedText(tokens)).toBe('went')
  })

  it('marks an inserted word such as a missing to', () => {
    const tokens = buildHighlightedTokens(
      'I want improve my English',
      'I want to improve my English',
      [{ type: 'grammar', original: '', corrected: 'to', start: 7, end: 7 }],
    )
    const marked = tokens.filter((t) => t.type !== 'equal')
    expect(marked.some((t) => t.value === 'to')).toBe(true)
    expect(marked[0]?.changeType).toBe('grammar')
  })

  it("marks the apostrophe in dont → don't", () => {
    const tokens = diffCharacters('dont', "don't", 'grammar')
    expect(tokens.map((t) => t.value).join('')).toBe("don't")
    expect(markedText(tokens)).toBe("'")
  })
})
