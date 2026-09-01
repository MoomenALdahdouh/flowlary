import {
  AI_MODELS,
  isValidAiResponseLength,
  TRANSLATION_SYSTEM_PROMPT,
  TRANSLATION_REFINEMENT_SYSTEM_PROMPT,
} from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'

export type TranslationProviderInput = {
  text: string
  sourceLanguage: string
  targetLanguage: string
  mode?: string
}

export type TranslationProviderResult = {
  translation: string
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export async function runTranslationProvider(
  config: AppConfig,
  input: TranslationProviderInput,
  signal?: AbortSignal,
): Promise<TranslationProviderResult> {
  const text = input.text.trim()
  if (!text) throw new Error('invalid_request')

  const userPayload = {
    text,
    source_language: input.sourceLanguage,
    target_language: input.targetLanguage,
    mode: input.mode ?? 'shortcut',
  }

  const result = await callGroqChat(config, {
    model: AI_MODELS.TRANSLATION,
    temperature: 0.2,
    maxTokens: 1200,
    responseFormat: 'text',
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(userPayload),
      },
    ],
    signal,
  })

  const translation = result.content.trim()
  if (!isValidAiResponseLength(translation)) {
    throw new Error('invalid_response')
  }

  return {
    translation,
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
    totalTokens: result.usage?.total_tokens,
  }
}

export async function runTranslationRefinement(
  config: AppConfig,
  input: TranslationProviderInput & { draftTranslation: string },
  signal?: AbortSignal,
): Promise<TranslationProviderResult> {
  const text = input.text.trim()
  const draft = input.draftTranslation.trim()
  if (!text || !draft) throw new Error('invalid_request')

  const userPayload = {
    text,
    draft_translation: draft,
    source_language: input.sourceLanguage,
    target_language: input.targetLanguage,
    mode: input.mode ?? 'shortcut',
  }

  const result = await callGroqChat(config, {
    model: AI_MODELS.TRANSLATION,
    temperature: 0.2,
    maxTokens: 1200,
    responseFormat: 'text',
    messages: [
      { role: 'system', content: TRANSLATION_REFINEMENT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(userPayload),
      },
    ],
    signal,
  })

  const translation = result.content.trim()
  if (!isValidAiResponseLength(translation)) {
    throw new Error('invalid_response')
  }

  return {
    translation,
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
    totalTokens: result.usage?.total_tokens,
  }
}
