import { describe, expect, it } from 'vitest'
import { readHashId, scrollToHash } from '../lib/scroll.ts'

describe('hash scrolling', () => {
  it('reads a hash id', () => {
    expect(readHashId('#get-flowlary')).toBe('get-flowlary')
    expect(readHashId('#how')).toBe('how')
    expect(readHashId('')).toBeNull()
    expect(readHashId('#')).toBeNull()
  })

  it('scrolls the matching element into view', () => {
    const calls: unknown[] = []
    const node = {
      scrollIntoView(opts?: ScrollIntoViewOptions) {
        calls.push(opts)
      },
    }
    const found = scrollToHash('#how', {
      getElementById: (id) => (id === 'how' ? (node as unknown as HTMLElement) : null),
    })
    expect(found).toBe(true)
    expect(calls).toEqual([{ block: 'start', behavior: 'auto' }])
  })

  it('returns false when the target is missing', () => {
    expect(scrollToHash('#missing', { getElementById: () => null })).toBe(false)
  })
})
