import { describe, expect, it } from 'vitest'
import { AI_MODELS } from '@flowlary/shared'

describe('AI model configuration', () => {
  it('uses historical correction model', () => {
    expect(AI_MODELS.CORRECTION).toBe('llama-3.1-8b-instant')
  })

  it('uses historical translation model', () => {
    expect(AI_MODELS.TRANSLATION).toBe('openai/gpt-oss-120b')
  })

  it('uses historical layout classifier model', () => {
    expect(AI_MODELS.LAYOUT_CLASSIFIER).toBe('allam-2-7b')
  })
})
