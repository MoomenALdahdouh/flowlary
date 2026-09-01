import { describe, expect, it } from 'vitest'
import { SECURITY_LIMITS } from '@flowlary/shared'
import {
  validateExtensionRequest,
  validateContentCommandType,
} from '../../../extension/src/messaging/validate.ts'

describe('runtime message validation', () => {
  it('rejects null and non-objects', () => {
    expect(validateExtensionRequest(null).ok).toBe(false)
    expect(validateExtensionRequest([]).ok).toBe(false)
    expect(validateExtensionRequest('TRANSLATE').ok).toBe(false)
  })

  it('rejects unknown message types', () => {
    expect(validateExtensionRequest({ type: 'UNKNOWN' }).ok).toBe(false)
    expect(validateExtensionRequest({ type: 'EXECUTE_CODE' }).ok).toBe(false)
  })

  it('accepts GET_STATUS', () => {
    expect(validateExtensionRequest({ type: 'GET_STATUS' }).ok).toBe(true)
  })

  it('rejects malformed RUN_COMMAND payloads', () => {
    expect(validateExtensionRequest({ type: 'RUN_COMMAND' }).ok).toBe(false)
    expect(validateExtensionRequest({ type: 'RUN_COMMAND', operation: null }).ok).toBe(false)
    expect(validateExtensionRequest({ type: 'RUN_COMMAND', operation: 'EXECUTE_CODE' }).ok).toBe(false)
    expect(validateExtensionRequest({ type: 'RUN_COMMAND', operation: 'PIPELINE' }).ok).toBe(false)
  })

  it('accepts valid RUN_COMMAND operations', () => {
    for (const operation of ['TRANSLATE', 'FIX_LAYOUT', 'CORRECT'] as const) {
      const result = validateExtensionRequest({ type: 'RUN_COMMAND', operation })
      expect(result.ok).toBe(true)
    }
  })

  it('rejects PIPELINE in DISPATCH_COMMAND', () => {
    const result = validateExtensionRequest({
      type: 'DISPATCH_COMMAND',
      command: { type: 'PIPELINE' },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('pipeline_not_implemented')
  })

  it('rejects oversized translation text', () => {
    const huge = 'x'.repeat(SECURITY_LIMITS.MAX_TRANSLATION_TEXT_LENGTH + 1)
    const result = validateExtensionRequest({
      type: 'TRANSLATE_TEXT',
      text: huge,
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      mode: 'shortcut',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects invalid language codes', () => {
    const result = validateExtensionRequest({
      type: 'TRANSLATE_TEXT',
      text: 'hello',
      sourceLanguage: 'xx',
      targetLanguage: 'ar',
      mode: 'shortcut',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects CORRECT_TEXT without bounded request id', () => {
    expect(
      validateExtensionRequest({
        type: 'CORRECT_TEXT',
        requestId: '',
        text: 'hello',
      }).ok,
    ).toBe(false)
    expect(
      validateExtensionRequest({
        type: 'CORRECT_TEXT',
        requestId: 'req-1',
        text: '',
      }).ok,
    ).toBe(false)
  })

  it('preserves practice mode on CORRECT_TEXT', () => {
    const result = validateExtensionRequest({
      type: 'CORRECT_TEXT',
      requestId: 'req-practice-1',
      text: 'I has a cat',
      mode: 'practice',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatchObject({ type: 'CORRECT_TEXT', mode: 'practice' })
    }
  })

  it('ignores unknown CORRECT_TEXT modes', () => {
    const result = validateExtensionRequest({
      type: 'CORRECT_TEXT',
      requestId: 'req-1',
      text: 'hello',
      mode: 'evil',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect((result.value as { mode?: string }).mode).toBeUndefined()
    }
  })

  it('validateContentCommandType rejects malformed content messages', () => {
    expect(validateContentCommandType(null).ok).toBe(false)
    expect(validateContentCommandType({ type: 'GET_STATUS' }).ok).toBe(false)
    expect(validateContentCommandType({ type: 'RUN_COMMAND', operation: 'PIPELINE' }).ok).toBe(false)
  })

  it('validateContentCommandType accepts RUN_COMMAND from service worker', () => {
    const result = validateContentCommandType({ type: 'RUN_COMMAND', operation: 'TRANSLATE' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('TRANSLATE')
  })
})
