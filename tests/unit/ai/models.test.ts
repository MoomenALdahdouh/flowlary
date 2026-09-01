import { describe, expect, it } from 'vitest'
import { AI_MODELS } from '@flowlary/shared'

describe('AI model configuration', () => {
  it('uses current Groq correction model', () => {
    expect(AI_MODELS.CORRECTION).toBe('openai/gpt-oss-20b')
  })

  it('uses historical translation model', () => {
    expect(AI_MODELS.TRANSLATION).toBe('openai/gpt-oss-120b')
  })

  it('uses historical layout classifier model', () => {
    expect(AI_MODELS.LAYOUT_CLASSIFIER).toBe('allam-2-7b')
  })

  it('uses gpt-oss-20b for the hypothesis advisor only', () => {
    expect(AI_MODELS.HYPOTHESIS_ADVISOR).toBe('openai/gpt-oss-20b')
    expect(AI_MODELS.LAYOUT_CLASSIFIER).toBe('allam-2-7b')
    expect(AI_MODELS.CORRECTION).toBe('openai/gpt-oss-20b')
    expect(AI_MODELS.TRANSLATION).toBe('openai/gpt-oss-120b')
  })
})
