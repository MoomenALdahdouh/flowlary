import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'
import type { LearningCoachResponse, UiLocaleCode } from '@flowlary/shared'
import { AI_MODELS, buildGroqCoachPayload, type LearningCoachContext } from '@flowlary/shared'

export const LEARNING_COACH_MODEL = AI_MODELS.CORRECTION

const CEFR_PATTERN = /\b(A1|A2|B1|B2|C1|C2|CEFR)\b/i

const SYSTEM_PROMPT = `You are Flowlary's English Learning Coach — a tutor, not an analytics engine.
You may ONLY describe facts contained in the supplied structured evidence JSON.
You MUST NOT invent errors, grammar rules, statistics, CEFR levels, mastery claims, psychology diagnoses, or unsupported categories.
Layout and translation are not English learning evidence — never mention them.
If evidence is insufficient, say so clearly and encourage continued writing.
Only cite ruleId or ruleTitle when present in recurringPatterns[].explanation.
Never invent rule IDs.
Every recommendation must connect to provided evidence.
Respond with JSON only:
{"summary":"...","observations":["..."],"recommendations":["..."],"explanations":["..."],"actions":[{"kind":"practice_pattern|practice_focus|view_progress|open_report|keep_writing","targetPatternId?":"...","focus?":"spelling|grammar|wording"}],"evidenceReferences":["..."]}
Keep English correction examples (original → corrected) in English even when writing in another language.`

export type LearningCoachInput = {
  locale: UiLocaleCode
  context: LearningCoachContext
}

function validateBasicCoachShape(raw: unknown): LearningCoachResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : ''
  if (!summary || CEFR_PATTERN.test(summary)) return null

  const stringArrays = ['observations', 'recommendations', 'explanations', 'evidenceReferences'] as const
  for (const key of stringArrays) {
    if (!Array.isArray(obj[key]) || !(obj[key] as unknown[]).every((item) => typeof item === 'string')) {
      return null
    }
    for (const line of obj[key] as string[]) {
      if (CEFR_PATTERN.test(line)) return null
    }
  }

  if (!Array.isArray(obj.actions)) return null

  return {
    summary,
    observations: (obj.observations as string[]).slice(0, 5),
    recommendations: (obj.recommendations as string[]).slice(0, 5),
    explanations: (obj.explanations as string[]).slice(0, 3),
    actions: (obj.actions as LearningCoachResponse['actions']).slice(0, 4),
    evidenceReferences: (obj.evidenceReferences as string[]).slice(0, 6),
    source: 'ai',
  }
}

export type LearningCoachProviderResult = {
  data: LearningCoachResponse
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export async function runLearningCoachProvider(
  config: AppConfig,
  input: LearningCoachInput,
  signal?: AbortSignal,
): Promise<LearningCoachProviderResult> {
  if (!input.locale || typeof input.locale !== 'string') {
    throw new Error('invalid_request')
  }
  if (!input.context || typeof input.context !== 'object') {
    throw new Error('invalid_request')
  }

  const payload = buildGroqCoachPayload(input.context)

  const result = await callGroqChat(config, {
    model: LEARNING_COACH_MODEL,
    temperature: 0.2,
    maxTokens: 800,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ locale: input.locale, evidence: payload }),
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

  const validated = validateBasicCoachShape(parsed)
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
