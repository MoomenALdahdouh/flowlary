import {
  AI_MODELS,
  buildTranslationRefinementUserMessage,
  buildTranslationUserMessage,
  isValidAiResponseLength,
  parseGroqTranslationContent,
  TRANSLATION_SYSTEM_PROMPT,
  TRANSLATION_REFINEMENT_SYSTEM_PROMPT,
} from '@flowlary/shared'
import type { TranslationRequestContext } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'

export type TranslationProviderInput = {
  text: string
  sourceLanguage: string
  targetLanguage: string
  mode?: string
  translationContext?: TranslationRequestContext
}

export type TranslationProviderResult = {
  translation: string
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

const URL_PATTERN = /https?:\/\/\S+/gi
const NUMBER_PATTERN = /\d[\d,.]*/g

/** Cheap deterministic guard — reject refine output that drops protected spans from source. */
export function refinementPreservesProtectedSpans(
  source: string,
  refined: string,
): boolean {
  for (const url of source.match(URL_PATTERN) ?? []) {
    if (!refined.includes(url)) return false
  }
  for (const num of source.match(NUMBER_PATTERN) ?? []) {
    if (num.length >= 2 && !refined.includes(num)) return false
  }
  return true
}

export async function runTranslationProvider(
  config: AppConfig,
  input: TranslationProviderInput,
  signal?: AbortSignal,
): Promise<TranslationProviderResult> {
  const text = input.text.trim()
  if (!text) throw new Error('invalid_request')

  const userMessage = buildTranslationUserMessage({
    text,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    mode: input.mode,
  })

  const result = await callGroqChat(config, {
    model: AI_MODELS.TRANSLATION,
    temperature: 0,
    maxTokens: 2048,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    signal,
  })

  const translation = parseGroqTranslationContent(result.content)
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

  const userMessage = buildTranslationRefinementUserMessage({
    text,
    draftTranslation: draft,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    mode: input.mode,
  })

  const result = await callGroqChat(config, {
    model: AI_MODELS.TRANSLATION,
    temperature: 0,
    maxTokens: 1200,
    responseFormat: 'text',
    messages: [
      { role: 'system', content: TRANSLATION_REFINEMENT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    signal,
  })

  const translation = result.content.trim()
  if (!isValidAiResponseLength(translation)) {
    throw new Error('invalid_response')
  }
  if (!refinementPreservesProtectedSpans(text, translation)) {
    throw new Error('refinement_preserve_lost')
  }

  return {
    translation,
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
    totalTokens: result.usage?.total_tokens,
  }
}
