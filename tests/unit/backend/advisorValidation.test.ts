import { describe, expect, it } from 'vitest'
import { validateAdvisorProviderContent } from '../../../backend/src/providers/advisorValidation.ts'

const metadata = {
  provider: 'test',
  model: 'test-model',
  latencyMs: 12,
}
const allowedIds = new Set(['h1', 'h2'])

describe('advisor provider response validation', () => {
  it('accepts the exact ID-only contract', () => {
    const result = validateAdvisorProviderContent(
      JSON.stringify({
        rankedHypothesisIds: ['h2', 'h1'],
        ambiguityClass: 'layout_vs_preserve',
        reasonCode: 'context',
      }),
      allowedIds,
      metadata,
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rankedHypothesisIds).toEqual(['h2', 'h1'])
  })

  it.each([
    'replacement',
    'text',
    'write',
    'html',
    'mutation',
    'commands',
    'domOperation',
    'inputValue',
    'setRangeText',
    'execCommand',
  ])('rejects forbidden output field %s', (field) => {
    const result = validateAdvisorProviderContent(
      JSON.stringify({
        rankedHypothesisIds: ['h1'],
        ambiguityClass: 'test',
        reasonCode: 'test',
        [field]: 'unsafe',
      }),
      allowedIds,
      metadata,
    )
    expect(result).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('normalizes malformed JSON, schema, unknown IDs, and empty output', () => {
    expect(validateAdvisorProviderContent('{', allowedIds, metadata))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    expect(validateAdvisorProviderContent('{}', allowedIds, metadata))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    expect(validateAdvisorProviderContent(
      '{"rankedHypothesisIds":["missing"],"ambiguityClass":"x","reasonCode":"y"}',
      allowedIds,
      metadata,
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    expect(validateAdvisorProviderContent('', allowedIds, metadata))
      .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('classifies empty length-terminated output as a contract failure', () => {
    expect(validateAdvisorProviderContent('', allowedIds, {
      ...metadata,
      finishReason: 'length',
    })).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('rejects duplicate IDs and unrecognized extra fields', () => {
    expect(validateAdvisorProviderContent(
      '{"rankedHypothesisIds":["h1","h1"],"ambiguityClass":"x","reasonCode":"y"}',
      allowedIds,
      metadata,
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    expect(validateAdvisorProviderContent(
      '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"y","note":"z"}',
      allowedIds,
      metadata,
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('rejects the exact write-injection payloads used in production hardening', () => {
    const payloads = [
      { rankedHypothesisIds: ['h1'], replacement: 'MALICIOUS', ambiguityClass: 'x', reasonCode: 'y' },
      { rankedHypothesisIds: ['fake-id'], ambiguityClass: 'x', reasonCode: 'y' },
      { rankedHypothesisIds: ['h1', 'h1'], ambiguityClass: 'x', reasonCode: 'y' },
      { rankedHypothesisIds: ['h1'], write: true, ambiguityClass: 'x', reasonCode: 'y' },
      { rankedHypothesisIds: ['h1'], text: 'replace everything', ambiguityClass: 'x', reasonCode: 'y' },
      { rankedHypothesisIds: ['h1'], domAction: 'setRangeText', ambiguityClass: 'x', reasonCode: 'y' },
    ]
    for (const payload of payloads) {
      expect(validateAdvisorProviderContent(JSON.stringify(payload), allowedIds, metadata))
        .toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    }
  })

  it('rejects mutation instructions hidden in allowed string fields', () => {
    expect(validateAdvisorProviderContent(
      '{"rankedHypothesisIds":["h1"],"ambiguityClass":"x","reasonCode":"call setRangeText"}',
      allowedIds,
      metadata,
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
    expect(validateAdvisorProviderContent(
      '{"rankedHypothesisIds":["h1"],"ambiguityClass":"execCommand insertText","reasonCode":"x"}',
      allowedIds,
      metadata,
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })

  it('rejects non-code ambiguity and reason values', () => {
    expect(validateAdvisorProviderContent(
      '{"rankedHypothesisIds":["h1"],"ambiguityClass":"<script>","reasonCode":"context"}',
      allowedIds,
      metadata,
    )).toMatchObject({ ok: false, category: 'CONTRACT_FAILURE' })
  })
})
