import { AI_MODELS, LAYOUT_CLASSIFIER_SYSTEM_PROMPT } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { callGroqChat } from './groqClient.ts'

export type LayoutClassifierInput = {
  word: string
  context?: string
  sourceLayout: string
  candidateLayouts: string[]
}

export type LayoutClassifierResult = {
  kind: 'VALID' | 'LAYOUT_MISMATCH'
  targetLayout?: string
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

function parseClassifierJson(
  content: string,
  candidates: string[],
): { kind: 'VALID' | 'LAYOUT_MISMATCH'; targetLayout?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('invalid_response')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid_response')
  const obj = parsed as Record<string, unknown>
  const kind = obj.kind
  if (kind === 'VALID') {
    return { kind: 'VALID' }
  }
  if (kind === 'LAYOUT_MISMATCH') {
    const target = typeof obj.target_layout === 'string' ? obj.target_layout : undefined
    if (!target || !candidates.includes(target)) {
      throw new Error('invalid_response')
    }
    return { kind: 'LAYOUT_MISMATCH', targetLayout: target }
  }
  throw new Error('invalid_response')
}

export async function runLayoutClassifierProvider(
  config: AppConfig,
  input: LayoutClassifierInput,
  signal?: AbortSignal,
): Promise<LayoutClassifierResult> {
  const word = input.word.trim()
  if (!word) throw new Error('invalid_request')
  const candidates = input.candidateLayouts.filter((layout) => layout !== input.sourceLayout)
  if (candidates.length === 0) throw new Error('invalid_request')

  const userPayload = {
    word,
    context: input.context ?? '',
    source_layout: input.sourceLayout,
    candidate_layouts: candidates,
  }

  const result = await callGroqChat(config, {
    model: AI_MODELS.LAYOUT_CLASSIFIER,
    temperature: 0,
    maxTokens: 120,
    responseFormat: 'json_object',
    messages: [
      { role: 'system', content: LAYOUT_CLASSIFIER_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
    signal,
  })

  const classified = parseClassifierJson(result.content, candidates)
  return {
    kind: classified.kind,
    targetLayout: classified.targetLayout,
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
    totalTokens: result.usage?.total_tokens,
  }
}
