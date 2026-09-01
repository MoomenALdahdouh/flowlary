import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'
import {
  AI_MODELS,
  validateExplanationLocalizeRequest,
  validateExplanationLocalizeResponse,
  type ExplanationLocalizeRequest,
  type ExplanationLocalizeResponse,
} from '@flowlary/shared'

export const EXPLANATION_LOCALIZE_MODEL = AI_MODELS.CORRECTION

const SYSTEM_PROMPT = `You localize existing educational English grammar/spelling explanations.
You are NOT identifying the rule.
You are NOT allowed to introduce new facts.
You must preserve any English examples exactly as provided.
You must not change correction pairs.
You must not invent grammar terminology.
Translate/localize only the supplied educational text fields.
Respond with JSON only: {"ruleTitle":"...","summary":"...","why":"..."}`

export type ExplanationLocalizeProviderResult = {
  data: ExplanationLocalizeResponse
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export async function runExplanationLocalizeProvider(
  config: AppConfig,
  input: ExplanationLocalizeRequest,
  signal?: AbortSignal,
): Promise<ExplanationLocalizeProviderResult> {
  if (!validateExplanationLocalizeRequest(input)) {
    throw new Error('invalid_request')
  }

  const userPayload = {
    locale: input.locale,
    ruleTitle: input.ruleTitle,
    summary: input.summary,
    why: input.why ?? '',
  }

  const result = await callGroqChat(config, {
    model: EXPLANATION_LOCALIZE_MODEL,
    temperature: 0.1,
    maxTokens: 400,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(userPayload),
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

  const validated = validateExplanationLocalizeResponse(parsed, input)
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
