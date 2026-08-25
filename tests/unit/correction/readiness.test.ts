import { describe, expect, it } from 'vitest'
import { DEFAULT_CORRECTION } from '../../../extension/src/core/state/StateManager.ts'
import {
  isCorrectionAiReady,
  usesManagedCorrection,
} from '../../../extension/src/features/correction/readiness.ts'

describe('correction AI readiness', () => {
  it('managed mode requires consent only', () => {
    const settings = {
      ...DEFAULT_CORRECTION,
      aiProvider: 'managed' as const,
      consentAccepted: true,
      groqApiKey: '',
    }
    expect(usesManagedCorrection(settings)).toBe(true)
    expect(isCorrectionAiReady(settings)).toBe(true)
  })

  it('BYOK mode requires groq key and consent', () => {
    const settings = {
      ...DEFAULT_CORRECTION,
      aiProvider: 'byok' as const,
      consentAccepted: true,
      groqApiKey: '',
    }
    expect(usesManagedCorrection(settings)).toBe(false)
    expect(isCorrectionAiReady(settings)).toBe(false)
  })
})
