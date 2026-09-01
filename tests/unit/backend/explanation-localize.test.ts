import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateExplanationLocalizeResponse } from '@flowlary/shared'
import { runExplanationLocalizeProvider } from '../../../backend/src/providers/explanationLocalizeProvider.ts'

vi.mock('../../../backend/src/providers/groqClient.ts', () => ({
  callGroqChat: vi.fn(),
}))

import { callGroqChat } from '../../../backend/src/providers/groqClient.ts'

const config = {
  groqApiKey: 'test-key',
  requestTimeoutMs: 5000,
} as import('../../../backend/src/config/env.ts').AppConfig

describe('explanation localize provider', () => {
  beforeEach(() => {
    vi.mocked(callGroqChat).mockReset()
  })

  it('returns validated localized fields from Groq JSON', async () => {
    vi.mocked(callGroqChat).mockResolvedValue({
      content: JSON.stringify({
        ruleTitle: 'Receive yazımı',
        summary: 'Receive fiili ei ile yazılır.',
        why: 'Yaygın kalıp.',
      }),
      model: 'llama-3.1-8b-instant',
    })

    const result = await runExplanationLocalizeProvider(config, {
      locale: 'tr',
      ruleId: 'english.spelling.receive_ie_ei',
      ruleVersion: '1.0',
      ruleTitle: 'Receive spelling',
      summary: "The verb 'receive' is written with 'ei'.",
      why: 'Common pattern.',
    })

    expect(result.data.ruleTitle).toBe('Receive yazımı')
    expect(callGroqChat).toHaveBeenCalledOnce()
    const messages = vi.mocked(callGroqChat).mock.calls[0]?.[1].messages ?? []
    expect(JSON.stringify(messages)).not.toContain('recieve')
  })

  it('rejects malformed Groq response', async () => {
    vi.mocked(callGroqChat).mockResolvedValue({
      content: JSON.stringify({ ruleTitle: '', summary: 'x', ruleId: 'hacked' }),
      model: 'llama-3.1-8b-instant',
    })

    await expect(
      runExplanationLocalizeProvider(config, {
        locale: 'tr',
        ruleId: 'english.spelling.receive_ie_ei',
        ruleVersion: '1.0',
        ruleTitle: 'Receive spelling',
        summary: 'Summary',
      }),
    ).rejects.toThrow('invalid_response')
  })

  it('validateExplanationLocalizeResponse rejects confidence mutation', () => {
    const request = {
      locale: 'ar' as const,
      ruleId: 'english.spelling.receive_ie_ei',
      ruleVersion: '1.0',
      ruleTitle: 'Receive spelling',
      summary: 'Summary',
    }
    expect(
      validateExplanationLocalizeResponse(
        { ruleTitle: 'عنوان', summary: 'ملخص', confidence: 'high' },
        request,
      ),
    ).toBeNull()
  })
})
