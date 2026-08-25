import { describe, expect, it } from 'vitest'
import {
  computeFeatureStatus,
  formatLanguagePair,
  groqKeyLabel,
  readinessLabel,
} from '../../../extension/src/popup/status.ts'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'
import { BRAND } from '@flowlary/shared'

function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    brand: BRAND,
    active: true,
    features: { correction: true, translation: true, layout: true },
    translation: {
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    },
    correction: {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      hasGroqKey: true,
    },
    layout: {
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
    },
    version: '1.0.0',
    ...overrides,
  }
}

describe('popup status helpers', () => {
  it('marks correction setup when Groq key is missing', () => {
    const status = computeFeatureStatus(
      baseStatus({
        correction: {
          enabled: true,
          mode: 'direct',
          highlights: true,
          consentAccepted: false,
          hasGroqKey: false,
        },
      }),
    )
    expect(status.correction).toBe('setup')
    expect(status.summary).toContain('setup')
    expect(status.summaryTone).toBe('warn')
  })

  it('marks all features paused when extension is inactive', () => {
    const status = computeFeatureStatus(baseStatus({ active: false }))
    expect(status.correction).toBe('paused')
    expect(status.translation).toBe('paused')
    expect(status.layout).toBe('paused')
  })

  it('formats language pairs', () => {
    expect(formatLanguagePair('ar', 'en', 'Arabic', 'English')).toBe('Arabic → English')
  })

  it('labels Groq key state without exposing secrets', () => {
    expect(groqKeyLabel(true)).toBe('Connected')
    expect(groqKeyLabel(false)).toBe('Not configured')
  })

  it('maps readiness labels for UI', () => {
    expect(readinessLabel('ready')).toBe('Ready')
    expect(readinessLabel('setup')).toBe('Setup required')
  })
})
