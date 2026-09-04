import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTranslationRefinementUserMessage,
  parseGroqTranslationContent,
  predictClientTranslationStrategy,
  TRANSLATION_REFINEMENT_SYSTEM_PROMPT,
  TRANSLATION_SYSTEM_PROMPT,
} from '../../packages/shared/src/ai/translation.ts'
import {
  liveTranslationPolishEligible,
  needsTranslationPolish,
} from '../../backend/src/providers/needsTranslationPolish.ts'
import {
  refinementPreservesProtectedSpans,
  runTranslationRefinement,
} from '../../backend/src/providers/translationProvider.ts'
import {
  shouldAttemptTranslationRefinement,
} from '../../backend/src/providers/translationRouter.ts'

describe('lingo-style groq translation contract', () => {
  it('asks for JSON translation and forbids والله as I swear', () => {
    expect(TRANSLATION_SYSTEM_PROMPT).toMatch(/JSON object/i)
    expect(TRANSLATION_SYSTEM_PROMPT).toMatch(/never "I swear"/i)
    expect(TRANSLATION_SYSTEM_PROMPT).toMatch(/منا عارف/)
  })

  it('parses Groq JSON translation payloads', () => {
    expect(parseGroqTranslationContent('{"translation":"Honestly, I dunno, maybe I\'ll come."}')).toBe(
      "Honestly, I dunno, maybe I'll come.",
    )
  })
})

describe('translation refinement prompt', () => {
  it('establishes post-editor contract', () => {
    expect(TRANSLATION_REFINEMENT_SYSTEM_PROMPT).toMatch(/post-editor/i)
    expect(TRANSLATION_REFINEMENT_SYSTEM_PROMPT).toMatch(/authoritative/i)
    expect(TRANSLATION_REFINEMENT_SYSTEM_PROMPT).toMatch(/natural conversational English/i)
    expect(TRANSLATION_REFINEMENT_SYSTEM_PROMPT).not.toMatch(/والله → honestly/i)
  })

  it('builds source + google draft user message', () => {
    const message = buildTranslationRefinementUserMessage({
      text: 'والله يمكن اجي',
      draftTranslation: 'I swear I might come',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
    })
    expect(message).toContain('SOURCE:')
    expect(message).toContain('GOOGLE DRAFT:')
    expect(message).toContain('والله يمكن اجي')
    expect(message).toContain('I swear I might come')
    expect(message).toContain('Rewrite the Google draft into natural conversational English')
  })
})

describe('predictClientTranslationStrategy', () => {
  it('uses groq for pro live', () => {
    expect(predictClientTranslationStrategy({ plan: 'pro', mode: 'live' })).toBe('groq')
  })

  it('uses groq for signed-in unknown plan so Google cache cannot win', () => {
    expect(predictClientTranslationStrategy({ plan: 'unknown', signedIn: true })).toBe('groq')
  })

  it('uses google for free live', () => {
    expect(predictClientTranslationStrategy({ plan: 'free', mode: 'live' })).toBe('google')
  })
})

describe('needsTranslationPolish', () => {
  const colloquial = 'والله يمكن اجي اه بس مش عارف ليش بطني بيجعني'
  const googleDraft =
    "I swear I might come, but I don't know why my stomach hurts."

  it('triggers for colloquial Arabic with literal Google draft', () => {
    const result = needsTranslationPolish({
      sourceText: colloquial,
      draftTranslation: googleDraft,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    expect(result.needsPolish).toBe(true)
    expect(result.reason).toMatch(/colloquial_marker|literal_oath|spoken_filler/)
  })

  it('does not trigger for simple MSA sentence with natural draft', () => {
    const result = needsTranslationPolish({
      sourceText: 'أنا ذاهب إلى الجامعة الآن.',
      draftTranslation: 'I am going to the university now.',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    expect(result.needsPolish).toBe(false)
  })

  it('triggers for Levantine spoken Arabic without trailing punctuation', () => {
    const result = needsTranslationPolish({
      sourceText: 'اسمع انت ابعتله الايمل وانا بس اروح بشوف شو باقي علينا شغل',
      draftTranslation:
        "Listen, you send him the email and I'll just go and see what work we still have to do.",
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    expect(result.needsPolish).toBe(true)
    expect(result.reason).toMatch(/colloquial_marker/)
  })
})

describe('liveTranslationPolishEligible', () => {
  it('requires segment_complete or focus_out_completion', () => {
    expect(liveTranslationPolishEligible({ segment_complete: true })).toBe(true)
    expect(liveTranslationPolishEligible({ focus_out_completion: true })).toBe(true)
    expect(liveTranslationPolishEligible({ segment_complete: false })).toBe(false)
    expect(liveTranslationPolishEligible(undefined)).toBe(false)
  })
})

describe('shouldAttemptTranslationRefinement', () => {
  const colloquial = 'والله يمكن اجي اه بس مش عارف ليش بطني بيجعني'
  const googleDraft =
    "I swear I might come, but I don't know why my stomach hurts."
  const levantine =
    'اسمع انت ابعتله الايمل وانا بس اروح بشوف شو باقي علينا شغل'
  const levantineGoogle =
    "Listen, you send him the email and I'll just go and see what work we still have to do."

  it('always attempts for manual shortcut', () => {
    expect(
      shouldAttemptTranslationRefinement(
        {
          text: 'hello',
          sourceLanguage: 'en',
          targetLanguage: 'es',
          mode: 'shortcut',
        },
        'hola',
      ).attempt,
    ).toBe(true)
  })

  it('skips live when segment is incomplete and draft looks natural', () => {
    expect(
      shouldAttemptTranslationRefinement(
        {
          text: 'أنا ذاهب إلى الجامعة',
          sourceLanguage: 'ar',
          targetLanguage: 'en',
          mode: 'live',
          translationContext: { segment_complete: false, focus_out_completion: false },
        },
        'I am going to the university',
      ),
    ).toEqual({ attempt: false, reason: 'live_incomplete_segment' })
  })

  it('attempts live colloquial on pause even without sentence punctuation', () => {
    expect(
      shouldAttemptTranslationRefinement(
        {
          text: levantine,
          sourceLanguage: 'ar',
          targetLanguage: 'en',
          mode: 'live',
          translationContext: { segment_complete: false, focus_out_completion: false },
        },
        levantineGoogle,
      ),
    ).toEqual({ attempt: true, reason: expect.stringMatching(/^live_colloquial:/) })
  })

  it('attempts live colloquial short phrase on pause without punctuation', () => {
    expect(
      shouldAttemptTranslationRefinement(
        {
          text: 'والله يمكن اجي',
          sourceLanguage: 'ar',
          targetLanguage: 'en',
          mode: 'live',
          translationContext: { segment_complete: false, focus_out_completion: false },
        },
        'I swear I might come',
      ).attempt,
    ).toBe(true)
  })

  it('attempts live colloquial complete sentence when polish is needed', () => {
    expect(
      shouldAttemptTranslationRefinement(
        {
          text: colloquial,
          sourceLanguage: 'ar',
          targetLanguage: 'en',
          mode: 'live',
          translationContext: { segment_complete: true },
        },
        googleDraft,
      ).attempt,
    ).toBe(true)
  })

  it('skips live MSA when draft looks natural', () => {
    expect(
      shouldAttemptTranslationRefinement(
        {
          text: 'أنا ذاهب إلى الجامعة الآن.',
          sourceLanguage: 'ar',
          targetLanguage: 'en',
          mode: 'live',
          translationContext: { segment_complete: true },
        },
        'I am going to the university now.',
      ).attempt,
    ).toBe(false)
  })
})

describe('refinementPreservesProtectedSpans', () => {
  it('rejects refined output that drops URLs', () => {
    const source = 'See https://example.com today'
    expect(refinementPreservesProtectedSpans(source, 'See the site today')).toBe(false)
    expect(refinementPreservesProtectedSpans(source, 'See https://example.com today')).toBe(true)
  })
})

describe('runTranslationRefinement input shape', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes source and draft to Groq user message', async () => {
    const calls: unknown[] = []
    const config = { groqApiKey: 'test' } as import('../../backend/src/config/env.ts').AppConfig
    const groq = await import('../../backend/src/providers/groqClient.ts')
    vi.spyOn(groq, 'callGroqChat').mockImplementation(async (_cfg, params) => {
      calls.push(params.messages)
      return {
        content: 'Honestly, maybe I\'ll come, yeah, but I don\'t know why my stomach hurts.',
        model: 'openai/gpt-oss-120b',
      }
    })

    const result = await runTranslationRefinement(config, {
      text: 'والله يمكن اجي اه بس مش عارف ليش بطني بيجعني',
      draftTranslation: "I swear I might come, but I don't know why my stomach hurts.",
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
    })

    expect(result.translation).toMatch(/Honestly|maybe/i)
    const userMessage = (calls[0] as { role: string; content: string }[])[1]?.content
    expect(userMessage).toContain('GOOGLE DRAFT:')
    expect(userMessage).toContain('SOURCE:')
  })
})
