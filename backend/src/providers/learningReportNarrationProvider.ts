import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'
import type { LearningReportNarrationResponse, UiLocaleCode } from '@flowlary/shared'
import { AI_MODELS, buildGroqReportPayload } from '@flowlary/shared'

export const LEARNING_REPORT_NARRATION_MODEL = AI_MODELS.CORRECTION

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2|CEFR)\b/i

const SYSTEM_PROMPT = `You are an educational English-learning report writer for Flowlary.
You may ONLY describe facts contained in the supplied structured evidence JSON.
You MUST NOT invent errors, grammar rules, statistics, CEFR levels, diagnoses, improvement, weaknesses, learning history, or unsupported categories.
Layout and translation are not English learning evidence — never mention them.
If evidence is insufficient, say that evidence is insufficient.
Every recommendation must connect to provided evidence.
Respond with JSON only:
{"overview":"...","strengths":["..."],"focusAreas":["..."],"improvements":["..."],"recommendations":["..."],"nextSteps":["..."]}
Keep English correction examples (original → corrected) in English even when writing in another language.`

export type LearningReportNarrationInput = {
  locale: UiLocaleCode
  snapshot: ReturnType<typeof buildGroqReportPayload>
}

function validateBasicNarrationShape(raw: unknown): LearningReportNarrationResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const overview = typeof obj.overview === 'string' ? obj.overview.trim() : ''
  if (!overview || CEFR_PATTERN.test(overview)) return null
  const arrays = ['strengths', 'focusAreas', 'improvements', 'recommendations', 'nextSteps'] as const
  for (const key of arrays) {
    if (!Array.isArray(obj[key]) || !(obj[key] as unknown[]).every((item) => typeof item === 'string')) {
      return null
    }
    for (const line of obj[key] as string[]) {
      if (CEFR_PATTERN.test(line)) return null
    }
  }
  return {
    overview,
    strengths: (obj.strengths as string[]).slice(0, 5),
    focusAreas: (obj.focusAreas as string[]).slice(0, 5),
    improvements: (obj.improvements as string[]).slice(0, 5),
    recommendations: (obj.recommendations as string[]).slice(0, 6),
    nextSteps: (obj.nextSteps as string[]).slice(0, 6),
  }
}

export type LearningReportNarrationProviderResult = {
  data: LearningReportNarrationResponse
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export async function runLearningReportNarrationProvider(
  config: AppConfig,
  input: LearningReportNarrationInput,
  signal?: AbortSignal,
): Promise<LearningReportNarrationProviderResult> {
  if (!input.locale || typeof input.locale !== 'string') {
    throw new Error('invalid_request')
  }
  if (!input.snapshot || typeof input.snapshot !== 'object') {
    throw new Error('invalid_request')
  }

  const result = await callGroqChat(config, {
    model: LEARNING_REPORT_NARRATION_MODEL,
    temperature: 0.2,
    maxTokens: 900,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ locale: input.locale, evidence: input.snapshot }),
      },
    ],
    signal,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(result.content)
  } catch {
    throw new Error('invalid_response')
  }

  const validated = validateBasicNarrationShape(parsed)
  if (!validated) {
    throw new Error('invalid_response')
  }

  return {
    data: validated,
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
    totalTokens: result.usage?.total_tokens,
  }
}
