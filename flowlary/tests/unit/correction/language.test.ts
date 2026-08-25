import { describe, expect, it } from 'vitest'
import {
  detectEnglish,
  isEligibleForCorrection,
  shouldShowEnglishAssistant,
} from '../../../extension/src/features/correction/language.ts'

describe('language detection', () => {
  it('accepts English drafts for API', () => {
    expect(isEligibleForCorrection('I dont know what to write today')).toBe(true)
  })

  it('rejects Arabic-only text', () => {
    expect(isEligibleForCorrection('مرحبا كيف حالك اليوم')).toBe(false)
    expect(shouldShowEnglishAssistant('مرحبا كيف حالك')).toBe(false)
  })

  it('rejects Turkish cues', () => {
    expect(detectEnglish('merhaba nasilsin bugun').isEnglish).toBe(false)
  })

  it('allows ambiguous short Latin drafts for UI only', () => {
    expect(shouldShowEnglishAssistant('hell hwo ate')).toBe(true)
    expect(isEligibleForCorrection('hell hwo ate')).toBe(false)
  })
})
