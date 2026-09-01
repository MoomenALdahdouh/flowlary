import {
  AI_MODELS,
  CORRECTION_DEFAULTS,
  CORRECTION_SYSTEM_PROMPT,
  isValidAiResponseLength,
  validateCorrectionResponse,
  type CorrectionResponse,
  type CorrectRequestContext,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'

function truncateForCorrection(text: string): string {
  if (text.length <= CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS) return text
  const slice = text.slice(-CORRECTION_DEFAULTS.MAX_CORRECTION_CHARS)
  const boundary = slice.search(/[.!?]\s/)
  if (boundary > 0 && boundary < slice.length / 2) {
    return slice.slice(boundary + 1).trimStart()
  }
  return slice
}

export type CorrectionProviderInput = {
  text: string
  fieldType?: string
  previousText?: string
}

export type CorrectionProviderResult = {
  data: CorrectionResponse
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export async function runCorrectionProvider(
  config: AppConfig,
  input: CorrectionProviderInput,
  signal?: AbortSignal,
): Promise<CorrectionProviderResult> {
  const trimmed = input.text.trim()
  if (!trimmed) throw new Error('invalid_request')

  const context: CorrectRequestContext = {
    fieldType: input.fieldType as CorrectRequestContext['fieldType'],
    previousText: input.previousText,
  }
  const segment = truncateForCorrection(trimmed)
  const previousText = context.previousText?.slice(-200)
  const userPayload = previousText
    ? { text: segment, previousText, fieldType: context.fieldType }
    : { text: segment, fieldType: context.fieldType }

  const result = await callGroqChat(config, {
    model: AI_MODELS.CORRECTION,
    temperature: 0.1,
    maxTokens: 4000,
    messages: [
      { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
    signal,
  })

  const validated = validateCorrectionResponse(JSON.parse(result.content), segment)
  if (!validated || !isValidAiResponseLength(validated.correctedText)) {
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
